# LCC_project

This is integrated in my Master's dissertation project. The goal is to use geospatial data, namely _Sentinel-2 Surface Reflectance_ imagery in order to classify the land cover of the whole region of Guinea-Bissau and part of Guinea, creating Land Cover Maps with the results that can be used in other projects.

## The goals

The available labeled data was obtained in 2021, and regards a very small number of points in the whole Region Of Interest (ROI). In this area, the manual labeling task is very costly, and thus other points to label should be chosen with care. Thus, one of the objectives falls under the scope of __Active Machine Learning:__ optimally choose a sample of unlabeled points to be labeled next, so that the models' performance can be optimally enhanced, without having to label many uninformative points.

We also want to update the Land Cover Maps with the least amount of resources needed, but taking advantage of the information we already have from 2021, which can be considered a Domain Adaptation problem.

## The repository

The scripts have been developed using __JavaScript__ (in Google Earth Engine's code editor) and __Python__.

* For the __Python__ scripts, the following packages were used:
  * numpy
  * pandas
  * sklearn
  * geopandas
  * rasterio
  * rioxarray
____

* Supervisors:
  * João Pedro Pedroso
  * Sofia Cardoso Pereira
  
  Huge thanks to [RSeT](https://www.rset.eu/) for providing the initial dataset and Earth Engine scripts.
