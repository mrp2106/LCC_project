/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var outGeo = ee.FeatureCollection("users/catarinagouveialopes/5_GB_CBADP/Boundaries/Adm_boundaries_GB__corrected"),
    newGeo = ee.FeatureCollection("projects/ee-up201906711/assets/outGeo_expanded");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Obtain ccdc coefficients for specified time length
//Result: ee.Image with desired coefficients

//Expanded for newGeo, with cloud coverage correction (parevalo's CCDC library)

var utils = require('users/parevalo_bu/gee-ccdc-tools:ccdcUtilities/inputs.js');
var ccdc_utils = require('users/parevalo_bu/gee-ccdc-tools:ccdcUtilities/ccdc.js');

Map.centerObject(newGeo, 9);

//
//##################################################################################################
// Auxiliary functions

function doIndices(collection) {
  return collection.map(function(image) {
    var NDVI =  calcNDVI(image);
    var NBR = calcNBR(image);
    var EVI = calcEVI(image);
    var EVI2 = calcEVI2(image);
    return image.addBands([NDVI, NBR, EVI, EVI2]);
  })
}

function calcNDVI(image) {
   var ndvi = ee.Image(image).normalizedDifference(['NIR', 'RED']).rename('NDVI');
   return ndvi;
}

function calcNBR(image) {
  var nbr = ee.Image(image).normalizedDifference(['NIR', 'SWIR2']).rename('NBR');
  return nbr;
}

function calcEVI(image) {
        
  var evi = ee.Image(image).expression(
          'float(2.5*(((B4) - (B3)) / ((B4) + (6 * (B3)) - (7.5 * (B1)) + 1)))',
          {
              'B4': ee.Image(image).select(['NIR']),
              'B3': ee.Image(image).select(['RED']),
              'B1': ee.Image(image).select(['BLUE'])
          }).rename('EVI');    
  
  return evi;
}

function calcEVI2(image) {
  var evi2 = ee.Image(image).expression(
        'float(2.5*(((B4) - (B3)) / ((B4) + (2.4 * (B3)) + 1)))',
        {
            'B4': image.select('NIR'),
            'B3': image.select('RED')
        });
  return evi2.rename('EVI2');
}

function calcNDFI(image) {
  var gv = [.0500, .0900, .0400, .6100, .3000, .1000]
  var shade = [0, 0, 0, 0, 0, 0]
  var npv = [.1400, .1700, .2200, .3000, .5500, .3000]
  var soil = [.2000, .3000, .3400, .5800, .6000, .5800]
  var cloud = [.9000, .9600, .8000, .7800, .7200, .6500]
  var cf = .1 // Not parameterized
  var cfThreshold = ee.Image.constant(cf)
  var unmixImage = ee.Image(image).unmix([gv, shade, npv, soil, cloud], true,true)
                  .rename(['band_0', 'band_1', 'band_2','band_3','band_4'])
  var newImage = ee.Image(image).addBands(unmixImage)
  var mask = newImage.select('band_4').lt(cfThreshold)
  var ndfi = ee.Image(unmixImage).expression(
    '((GV / (1 - SHADE)) - (NPV + SOIL)) / ((GV / (1 - SHADE)) + NPV + SOIL)', {
      'GV': ee.Image(unmixImage).select('band_0'),
      'SHADE': ee.Image(unmixImage).select('band_1'),
      'NPV': ee.Image(unmixImage).select('band_2'),
      'SOIL': ee.Image(unmixImage).select('band_3')
    })
    
  return ee.Image(newImage)
        .addBands(ee.Image(ndfi).rename(['NDFI']))
        .select(['band_0','band_1','band_2','band_3','NDFI'])
        .rename(['GV','Shade','NPV','Soil','NDFI'])
        .updateMask(mask)
  }

//
//###################################################################################################
//

function getS2(options) {
  //Note:s2 is only needed to determine CDI for the cloud masking. Then, its bands can be discarded
  // Dates over which to create a median composite.
  var start = (options && options.start) || '2016-03-01'
  var end = (options && options.end) || '2021-09-01'
  var startDoy = (options && options.startDOY) || 1
  var endDoy = (options && options.endDOY) || 366
  var region = (options && options.region) || null
  var targetBands = (options && options.targetBands) || ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8','B11','B12']
  var newnameBands = (options && options.targetBands) || ['BLUE','GREEN','RED','VNIR1','VNIR2','VNIR3','NIR','SWIR1','SWIR2'] //['BLUE','GREEN','RED','VNIR1','VNIR2','VNIR3','NIR','SWIR1','SWIR2', 'NDVI', 'NBR', 'EVI', 'EVI2']
  
  // Sentinel-2 Level 1C data.  Bands B7, B8, B8A and B10 from this
  // dataset are needed as input to CDI and the cloud mask function.
  var s2 = ee.ImageCollection('COPERNICUS/S2');
  
  // Cloud probability dataset.  The probability band is used in the cloud mask function.
  var s2c = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY');
  // Sentinel-2 surface reflectance data for the composite.
  var s2Sr = ee.ImageCollection('COPERNICUS/S2_SR');
  
  // S2 L1C for Cloud Displacement Index (CDI) bands.
  s2 = s2.filterDate(start, end).select(['B7', 'B8', 'B8A', 'B10']);
  
  // S2Cloudless for the cloud probability band.
  s2c = s2c.filterDate(start, end);
  // S2 L2A for surface reflectance bands.
  s2Sr = s2Sr.filterDate(start, end).select(targetBands);
  
  if (region) {
    s2 = s2.filterBounds(region)
    s2c = s2c.filterBounds(region)
    s2Sr = s2Sr.filterBounds(region)
  }
  // Join two collections on their 'system:index' property.
  // The propertyName parameter is the name of the property
  // that references the joined image.
  function indexJoin(collectionA, collectionB, propertyName) {
    var joined = ee.ImageCollection(ee.Join.saveFirst(propertyName).apply({
      primary: collectionA,
      secondary: collectionB,
      condition: ee.Filter.equals({
        leftField: 'system:index',
        rightField: 'system:index'})
    }));
    // Merge the bands of the joined image.
    return joined.map(function(image) {
      return image.addBands(ee.Image(image.get(propertyName)));
    });
  }
  
  // Aggressively mask clouds and shadows.
  function maskImage(image) {
    // Compute the cloud displacement index from the L1C bands.
    var cdi = ee.Algorithms.Sentinel2.CDI(image);
    var s2c = image.select('probability');
    var cirrus = image.select('B10').multiply(0.0001);
  
    // Assume low-to-mid atmospheric clouds to be pixels where probability
    // is greater than 65%, and CDI is less than -0.5. For higher atmosphere
    // cirrus clouds, assume the cirrus band is greater than 0.01.
    // The final cloud mask is one or both of these conditions.
    var isCloud = s2c.gt(65).and(cdi.lt(-0.5)).or(cirrus.gt(0.01));
  
    // Reproject is required to perform spatial operations at 20m scale.
    // 20m scale is for speed, and assumes clouds don't require 10m precision.
    isCloud = isCloud.focal_min(3).focal_max(16);
    isCloud = isCloud.reproject({crs: cdi.projection(), scale: 20});
  
    // Project shadows from clouds we found in the last step. This assumes we're working in
    // a UTM projection.
    var shadowAzimuth = ee.Number(90)
        .subtract(ee.Number(image.get('MEAN_SOLAR_AZIMUTH_ANGLE')));
  
    // With the following reproject, the shadows are projected 5km.
    isCloud = isCloud.directionalDistanceTransform(shadowAzimuth, 50);
    isCloud = isCloud.reproject({crs: cdi.projection(), scale: 100});
  
    isCloud = isCloud.select('distance').mask();
    return image
      .divide(10000).updateMask(isCloud.not())
      .set('system:time_start',ee.Image(image.get('l1c')).get('system:time_start'))
  }
  
  var renameBands = function(image) {
    var renamedImage = image.rename(newnameBands);
    return renamedImage;
  };
  
  // Rename bands of the ImageCollection
  var s2Srrenamed = s2Sr.map(renameBands);
  
  // Join the cloud probability dataset to surface reflectance.
  var withCloudProbability = indexJoin(s2Srrenamed, s2c, 'cloud_probability');
  // Join the L1C data to get the bands needed for CDI.
  var withS2L1C = indexJoin(withCloudProbability, s2, 'l1c');
  
  // Map the cloud masking function over the joined collection.
  //return withS2L1C;
  //return ee.ImageCollection(withS2L1C.map(maskImage));
  return doIndices(ee.ImageCollection(withS2L1C.map(maskImage))); //withS2L1C.map(maskImage)  
}

//
//###################################################################################################
//

var s2Params = {
  start: '2017-04-01',
  end: '2021-09-01',
  region: newGeo.geometry(),
  startDOY: 1,
  endDOY: 365
}

var wantedBands = ['BLUE','GREEN','RED','VNIR1','VNIR2','VNIR3','NIR','SWIR1','SWIR2',
                   'NDVI','NBR','EVI','EVI2']

var inputData = ee.ImageCollection(getS2(s2Params))
                    .select(wantedBands)
                    .filterDate(s2Params.start, s2Params.end)
                    .filterBounds(newGeo.geometry())

//
//###################################################################################################
//

var ccdcParameters = {
  breakpointBands: ['BLUE','GREEN','RED','VNIR1','VNIR2','VNIR3',
                    'NIR','SWIR1','SWIR2', 'NDVI', 'NBR', 'EVI', 'EVI2'],
  tmaskBands: ['GREEN', 'SWIR2'], //bands for cloud masking, normally green and swir
  minObservations: 5,
  chiSquareProbability: 0.9,
  minNumOfYearsScaler: 1.2, //Factors of minimum number of years to apply new fitting
  dateFormat: 1,
  lambda: 0.005,
  maxIterations: 40000,
  collection: inputData,
}

var results = ee.Algorithms.TemporalSegmentation.Ccdc(ccdcParameters)

var outputParams = {
  start: s2Params.start,
  end: s2Params.end,
  startDOY: s2Params.startDOY,
  endDOY: s2Params.endDOY,
  sensor: 's2',//'landsat',
  breakpointBands: ccdcParameters.breakpointBands,
  tmaskBands: ccdcParameters.tmaskBands,
  minObservations: ccdcParameters.minObservations,
  chiSquareProbability:ccdcParameters.chiSquareProbability,
  minNumOfYearsScaler: ccdcParameters.minNumOfYearsScaler,
  dateFormat: ccdcParameters.dateFormat,
  lambda: ccdcParameters.lambda,
  maxIterations: ccdcParameters.maxIterations,
  user: ee.data.getAssetRoots()[0].id.split('/')[1]
}

//Change these parameters
var outFolder = 'projects/ee-up201906711/assets/'
var outAsset = 's2cc_ccdc_output'
var outDesc = outAsset + '_asset'

var ccdc_image = ee.Image(
  ccdc_utils.buildCcdImage(
    results,
    4, 
    outputParams.breakpointBands
))

var ccdc_result_with_prop_params = ccdc_image.setMulti(outputParams)

print(ccdc_result_with_prop_params)

//Export
Export.image.toAsset({
  // Ensures we export the original CCDC array image
  image: ccdc_result_with_prop_params,
  description: outDesc,
  assetId: outFolder + outAsset,
  scale: 10,     
  maxPixels: 1e13,
  region: outGeo.geometry(),
  pyramidingPolicy: {
    ".default": 'sample'
  }
})
