# bugspots
bugspots is a bug location predictor that implements the "Bugspots" algorithm.

# install
not yet supported.

# documentation

## Bugspots
### #scan(opts, callback)

**opts** is an object containing the following:
```json
{
  repo: <repo>, // this is the location of the repo.
  branch: <branch>, // this is the branch you want to scan.
  depth: <depth>, // not implemented, as it is not implemented in the gem.
  regex: <regex> // regular expression to use to match commits to use.
}
```
**callback** pass in a function with the signature (err, hotspots), where hotspots returns an array
of hotspot objects containing the filename and the score of the file in sorted order.

# license
MIT

# author
Joe Forbes (joe.forbes@gmail.com)

#credits
based on Shuang Wang's bugspots Node.js package (http://github.com/swang/bugspots),

inspired by Ilya Grigorik's Ruby gem (http://github.com/igrigorik/bugspots),

inspired by Chris Louis and Rong Ou's Google Engineering Tools blog post "Bug Prediction at Google" (http://google-engtools.blogspot.com/2011/12/bug-prediction-at-google.html)
