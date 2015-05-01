# bugspots-jsf
bugspots is a bug location predictor that implements the "Bugspots" algorithm.

# install
not yet supported.

# documentation

## Bugspots
### #scan(opts, callback, [commitFilterCallback])

**opts** is an object containing the following:
```JavaScript
{
  repo: <repo>,
  headId: <commitish> || 'master',
  tailId: <commitish> || '',
  maxDepth: <integer> || 500,
  regex: <regex> || /\b(fix(es|ed)?|close(s|d)?)\b/i,
  useRelativeDates: <boolean> || false,
  batchSize: <integer> || 500
}
```
**callback** is a function with the signature (err, hotspots). When bugspots rankings are completed, this function is passed an array of hotspot objects with the following structure:
```JavaScript
{
  file: <path/within/repo>,
  score: <number>,
  fixCommits: <integer>,
  firstCommit: <date>,
  lastCommit: <date>
}
```
**commitFilterCallback** is a function with the signature (commit). This is called for each commit being analyzed. If a truthy value is returned by this function for a given commit, that commit will be treated as a bugfix commit for bugspots rankings. The commit object is part of the commits array returned by a call to the gift npm package's repo.commits() method, and (at some time recently) had at least the following properties that might be useful in determining if a commit should be included or not:
```JavaScript
{
  id: <commitHash>,
  committed_date: <date>,
  message: <string>,
  ...
}
```

# license
MIT

# author
Joe Forbes (joe.forbes@gmail.com)

#credits
based on Shuang Wang's bugspots Node.js package (http://github.com/swang/bugspots)

  , inspired by Ilya Grigorik's Ruby gem (http://github.com/igrigorik/bugspots)

  , inspired by Chris Louis and Rong Ou's Google Engineering Tools blog post "Bug Prediction at Google" (http://google-engtools.blogspot.com/2011/12/bug-prediction-at-google.html)
