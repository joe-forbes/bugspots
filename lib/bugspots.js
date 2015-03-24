'use strict';

var git = require('gift')
  , exec = require('child_process').exec;

function Bugspots() {
  this.hotspots = {}
}

function Fix(message, date, files) {
  this.message = message;
  this.date = date;
  this.files = files
}

function HotSpots(opts) {
  this.file = opts.file;
  this.score = opts.score;
  this.fixCommits = opts.fixCommits;
  this.firstCommit = opts.firstCommit;
  this.lastCommit = opts.lastCommit;
}

Bugspots.prototype.scan = function (opts, callback) {

  var _regex = /\b(fix(es|ed)?|close(s|d)?)\b/i;

  var repo = git(opts.repo)
    , branch = opts.branch || "master"
    , depth = opts.depth || 500
    , regex = opts.regex || _regex
    , useRelativeDates = opts.useRelativeDates || false
    , batchSize = opts.batchSize || 500
    , self = this
    , fixes = []
    , parents = []
    , depthAchieved = 0
    , commitsInProgress = 0;

  // this callback will be called when all of the commits have been processed.
  var sendOutput = function () {
    fixes.sort(function(a,b){return a.date - b.date});
    var endDate = useRelativeDates ? Date.parse(fixes[fixes.length - 1].date) + 1: Date.parse(new Date().toUTCString());
    var oldestUTC = Date.parse(fixes[0].date);
    console.log('endDate: ' + endDate);
    console.log('oldestUTC: ' + oldestUTC);
    fixes.forEach(function fixesLoop(fix) {
      fix.files.forEach(function fixLoop(file) {
        var fixUTC = Date.parse(fix.date)
          , t = 1 - ((endDate - fixUTC) / (endDate - oldestUTC));
        //console.log(file + ' t: ' + t);
        if (!self.hotspots[file]) {
          self.hotspots[file] = {score: 0, fixCommits: 0, firstCommit: fix.date};
        }
        self.hotspots[file].score += 1 / (1 + Math.exp((-12 * t) + 12));
        self.hotspots[file].fixCommits++;
        self.hotspots[file].lastCommit = fix.date;
      })
    });
    return callback(null,
      Object.keys(self.hotspots)
        .sort(function sortFn(a, b) {
          if (self.hotspots[a].score < self.hotspots[b].score) return 1;
          if (self.hotspots[b].score < self.hotspots[a].score) return -1;
          if (self.hotspots[a].file < self.hotspots[b].file) return 1;
          if (self.hotspots[b].file < self.hotspots[a].file) return -1;
          return 0;
        })
        .map(function mapFn(file) {
          return new HotSpots({
            file: file,
            score: self.hotspots[file].score,
            fixCommits: self.hotspots[file].fixCommits,
            firstCommit: self.hotspots[file].firstCommit,
            lastCommit: self.hotspots[file].lastCommit
          })
        })
    )
  };

  var commitListHandler = function (err, commits) {
    commitsInProgress = 0;

    if (err) {
      return callback(err)
    }

    commits.forEach(function(commit) {

      depthAchieved++;
      var parentPositionInParentsArray = parents.indexOf(commit.parents()[0].id);
      if (parentPositionInParentsArray < 0) {
        parents.push(commit.parents()[0].id);
      }

      /* Determine if the commit in question should be included.
       * Original logic is based on message only.
       * I think it might make sense to change it filter out commits with more than one parent.
       * From http://git-scm.com/docs/git-commit-tree:
       *    "Having more than one parent makes the commit a merge between several lines of history."
       */
      if (regex.test(commit.message)) {

        //prepare to find out what files changed in this commit.
        var cmd = 'git diff ' + commit.id + '..' + commit.parents()[0].id + ' --name-only'
          , opt = {cwd: commit.repo.path};

        commitsInProgress++;

        //asynchronously call diff command
        exec(cmd, opt, function execFn(err, stdout) {
          var files;

          if (err) {
            return callback(err)
          }

          files = stdout.split("\n").slice(0, -1);

          fixes.push(new Fix(commit.message.split("\n")[0], commit.committed_date, files));

          var commitIndexInParentsList = parents.indexOf(commit.id);

          if(commitIndexInParentsList > -1) {
            parents.splice(commitIndexInParentsList, 1);
          }

          commitsInProgress--;
          if (commitsInProgress === 0) {
//            console.log('parents.length: ' + parents.length);
            if (parents.length === 0 || depthAchieved === depth) {
              sendOutput();
            } else {
              var remainingDepth = depth - depthAchieved;
              var depthToRetrieve = remainingDepth > batchSize ? batchSize : remainingDepth;
              repo.commits(parents[0], depthToRetrieve, commitListHandler)
            }
          }
        })
      } else {
        var commitIndexInParentsList = parents.indexOf(commit.id);

        if(commitIndexInParentsList > -1) {
          parents.splice(commitIndexInParentsList, 1);
        }
      }
    });
  };

  var headCommitHandler = function(err, head) {
    if (err) {
      return callback(err)
    }

    var depthToRetrieve = depth > batchSize ? batchSize : depth;
    repo.commits(head.commit.id, depthToRetrieve, commitListHandler)
  };

  //retrieves the head commit for the branch
  repo.branch(branch, headCommitHandler);

};
module.exports = Bugspots;

