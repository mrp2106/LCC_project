/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var trainingLoaded_all_final_water = ee.FeatureCollection("users/catarinagouveialopes/7_GB_CCDC/0_GB__ReferenceData__all_2021__withwater_updated"),
    newGeo = ee.FeatureCollection("projects/ee-up201906711/assets/outGeo_expanded"),
    ccdImage_GB = ee.Image("projects/ee-up201906711/assets/s2cc_ccdc_output");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Created training dataset with ccdc coefficients as features. Model training and prediction
//Result: ee.Image with prediction class bands

//ccdImage_GB is the SENTINEL_ccdc_output, the resulting bands from the ccdc coefficients

var dates = require('users/parevalo_bu/gee-ccdc-tools:ccdcUtilities/dates.js');
var utils = require('users/parevalo_bu/gee-ccdc-tools:ccdcUtilities/api');

Map.centerObject(newGeo, 8);
Map.addLayer(trainingLoaded_all_final_water, {}, 'training data all');


//#######
// Get ancillary climate and elevation data
var ancillary = utils.Inputs.getAncillary()

// Format date based on CCDC date type
var dateFormatted = dates.convertDate({
  inputFormat: 1,
  inputDate: 2021,
  outputFormat: 1
})

var inputBands = ['BLUE','GREEN','RED','VNIR1','VNIR2','VNIR3',
                  'NIR','SWIR1','SWIR2', 'NDVI', 'NBR', 'EVI', 'EVI2']
var inputCoefs = ['INTP', 'SLP', 'COS', 'SIN', 'COS2','SIN2', 'COS3','SIN3', 'RMSE']
var segs = ["S1","S2","S3","S4"]

// Obtain predictors for training year.
var coefForTraining = utils.CCDC.getMultiCoefs(ccdImage_GB, dateFormatted, inputBands,
    inputCoefs, true, segs,'before').addBands(ancillary).unmask() //filter coeffs given dates using a mask

print('coefForTraining', coefForTraining) //Image, 180 bands

// Sample predictors for training year.
var trainingWithCoefs = coefForTraining.sampleRegions({
  collection: trainingLoaded_all_final_water,                         // TRAINING DATA FEATURE COLLECTION
  scale: 10, //30
  tileScale: 16,
  geometries: true
})

var bandsToClassify = ee.List(inputBands.map(function(b) {
    return inputCoefs.map(function(c) {
      return b.concat('_').concat(c)
    })})).flatten()


var savedCoefs = trainingLoaded_all_final_water.first().propertyNames().containsAll(bandsToClassify)
//savedCoefs is a boolean

trainingWithCoefs = ee.FeatureCollection(
  ee.Algorithms.If(savedCoefs, trainingLoaded_all_final_water, trainingWithCoefs)) // TRAINING DATA FEATURE COLLECTION

// Ancillary list inputs:
var ancillaryList = ['ELEVATION', 'ASPECT', 'DEM_SLOPE']//, 'RAINFALL', 'TEMPERATURE']

//characteristics for classification
var classificationProps = {
  ccdImage: ccdImage_GB,
  segLength: segs.length,
  inputBands: inputBands,
  ancillary: ancillary,
  ancillaryList: ancillaryList,
  trainingData: trainingWithCoefs,
  classifier: ee.Classifier.smileRandomForest(300),
  outGeo: newGeo,                                      
  trainingAttribute: 'C_ID_1',                         // training data column name
  featureList: inputCoefs,
  trainProp: null,
  seed: null,
  filteredProp: false
}
print(classificationProps)

// Define some export parameters
var exportParams = {
  'Coefficients': 'None', 
  'CoefType': 'Image',
  'LongFormat': 0,
  'DateFormat': 1,
  'NumSegs': segs.length,
  'Bands': inputBands,
}

var classSegs = ee.Image(
  ee.Image(utils.Classification.classifySegments( //Classify stack of CCDC coefficient, band-separated by segment
    classificationProps.ccdImage,
    classificationProps.segLength,
    classificationProps.inputBands,
    classificationProps.ancillary,
    classificationProps.ancillaryList,
    classificationProps.trainingData,
    classificationProps.classifier,
    classificationProps.outGeo,
    classificationProps.trainingAttribute,
    classificationProps.featureList,
    classificationProps.trainProp,
    classificationProps.seed,
    classificationProps.filteredProp))
  .clip(newGeo).setMulti(exportParams))


Map.addLayer(classSegs.select(0).clip(newGeo), //clip masks data not covered by the geometry
{min: 1, max: 7, palette: ['#006600', // 1. Closed Forest
                           '#99ff33', // 2. Open Forest
                           '#2d8659', // 3. Mangrove
                           '#c6538c', // 4. Savanna
                           '#808000', // 5. Cashew
                           '#804000', // 6. Non-Forest
                           '#0F5299'  // 7. Waterbodies
                          ]},
'First Segment');

//Export
Export.image.toAsset({
  image: ee.Image(classSegs).int8(),
  scale: 10,                        
  description: 's2cc_classification_segments_v2',
  assetId: 's2cc_classification_segments_v2',
  maxPixels: 1e13,
  region: newGeo.geometry().bounds(),
  pyramidingPolicy: {
    '.default': 'mode'
  }
})