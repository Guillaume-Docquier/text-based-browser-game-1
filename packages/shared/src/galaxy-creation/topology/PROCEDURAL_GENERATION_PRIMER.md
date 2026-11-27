# PRIMER ON PROCEDURAL GENERATION BECAUSE I WILL FORGET

The main concept is: take something structured, then throw a bunch of gaussian (normal) noise at it, and now it looks random

Every value used to determine any setting (nb arms, arm size, radius, angle, etc) gets some noise:

- mean controls the expected value
- std controls the noise (higher == more noise)
- and std of `spread radius / 4` gives you a decent spread with very few values outside the desired range
