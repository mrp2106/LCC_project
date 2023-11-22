/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var trainingLoaded_all_final_water = ee.FeatureCollection("users/catarinagouveialopes/7_GB_CCDC/0_GB__ReferenceData__all_2021__withwater_updated"),
    ccdc_image_GB = ee.Image("projects/ee-up201906711/assets/s2cc_ccdc_output"),
    classiSegs_GB = ee.Image("projects/ee-up201906711/assets/s2cc_classification_segments_v2"),
    newGeo = ee.FeatureCollection("projects/ee-up201906711/assets/outGeo_expanded");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Result visualization, Land Cover Map obtained by model prediction

Map.centerObject(newGeo, 9)

var utils = require('users/parevalo_bu/gee-ccdc-tools:ccdcUtilities/api')
var outGeo = classiSegs_GB.geometry

// function for obtaining land cover at date
function getLC(date, classiSegs) {

  var dateClassificationAfter = utils.Classification.getLcAtDate( 
    classiSegs_GB, 
    date, 
    classiSegs_GB.length, 
    ccdc_image_GB,
    'after',
    null, 
    null,
    ccdc_image_GB.select(['.*tStart','.*tEnd']), 
    1
  )
  
  var dateClassificationBefore = utils.Classification.getLcAtDate(
    classiSegs_GB, 
    date, 
    classiSegs_GB.length, 
    ccdc_image_GB,
    'before',
    null, 
    null,
    ccdc_image_GB.select(['.*tStart', '.*tEnd']), 
    1
  )
  
  var dateClassification = ee.Image.cat(
    [
      dateClassificationBefore, 
      dateClassificationAfter
    ]
  )
  .reduce(
    ee.Reducer.firstNonNull()
  )

  return dateClassification.rename(ee.String('LC_').cat(date))
}

//ee.Image with class output
var classification_2021_GB = getLC('2021-04-01', classiSegs_GB)



Map.addLayer(classification_2021_GB, 
{min: 1, max: 7, palette: ['#006600', // 1. Closed Forest
                           '#99ff33', // 2. Open Forest
                           '#2d8659', // 3. Mangrove
                           '#c6538c', // 4. Savanna
                           '#808000', // 5. Cashew
                           '#804000', // 6. Non-Forest
                           '#0000ff'  // 7. Water
                          ]},
'LC 2021');

// Add limits - just outlines
var empty = ee.Image().byte();
var gb_outlines = empty.paint({
  featureCollection: newGeo,
  color: 0,
  width:2
});
Map.addLayer(gb_outlines, {}, 'GB')

// Export
Export.image.toDrive({
  image: classification_2021_GB,
  description: 's2cc_0_GB_LC_CCDC_2021_7class_lonlat',
  region: newGeo.geometry().bounds(),
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
