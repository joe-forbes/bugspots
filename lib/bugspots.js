'use strict';

var git = require('gift');
var exec = require('child_process').exec;
var logger = require('../util/logger');

var logInstrumentation = true;

try {
  logger.addTarget({
    targetType: 'file', targetConfig: {
      level: 'debug',
      filename: './logs/debug.log',
      handleExceptions: true,
      json: false,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: false
    }
  });
} catch (e) {
  logger.debug('error adding file logging target. already added?');
}

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

Bugspots.prototype.scan = function (opts, callback, commitInclusionDecisionHandler) {

  var _regex = /\b(fix(es|ed)?|close(s|d)?)\b/i;

  var repo = git(opts.repo)
    , branch = opts.branch || "master"
    , depth = opts.depth || 500
    , regex = opts.regex || _regex
    , useRelativeDates = opts.useRelativeDates || false
    , batchSize = opts.batchSize || 500
    , markerCommitId = opts.markerCommitId || ''
    , self = this
    , fixes = []
    , parents = []
    , depthAchieved = 0
    , commitsInProgress = 0
    , markerCommitFound = false;

  /* Determine if the commit in question should be included.
   * Original logic is based on message only.
   * I think it might make sense to change it filter out commits with more than one parent.
   * From http://git-scm.com/docs/git-commit-tree:
   *    "Having more than one parent makes the commit a merge between several lines of history."
   */
  // this is the default commitInclusionDecisionHandler
  var defaultCommitInclusionDecisionHandler = function (commit) {
    logger.debug('testing commmit.message: ' + commit.message);
    return regex.test(commit.message);
  };

  var shouldIncludeCommit = commitInclusionDecisionHandler || defaultCommitInclusionDecisionHandler;

  // this callback will be called when all of the commits have been processed.
  var sendOutput = function () {
    logger.debug('entered sendOutput function. fixes.length: ' + fixes.length);
    if (fixes.length > 0) {
      fixes.sort(function (a, b) {
        return a.date - b.date
      });
      var endDate = useRelativeDates ? Date.parse(fixes[fixes.length - 1].date) + 1 : Date.parse(new Date().toUTCString());
      var oldestUTC = Date.parse(fixes[0].date);
      logger.debug('endDate: ' + endDate);
      logger.debug('oldestUTC: ' + oldestUTC);
      fixes.forEach(function fixesLoop(fix) {
        fix.files.forEach(function fixLoop(file) {
          var fixUTC = Date.parse(fix.date)
            , t = 1 - ((endDate - fixUTC) / (endDate - oldestUTC));
          if (!self.hotspots[file]) {
            self.hotspots[file] = {score: 0, fixCommits: 0, firstCommit: fix.date};
          }
          logger.debug('fileHit: ' + file);
          self.hotspots[file].score += 1 / (1 + Math.exp((-12 * t) + 12));
          self.hotspots[file].fixCommits++;
          self.hotspots[file].lastCommit = fix.date;
        })
      });
    }
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

  var dumpCommitList = function (commits) {
    if (!commits) return;
    var commitList = [];
    var commitsCount = commits.length;
    commits.forEach(function (commit) {
      var newCommit = JSON.parse(JSON.stringify(commit));
      newCommit.parentCommits = JSON.parse(JSON.stringify(commit.parents()));
      newCommit.repo = JSON.parse(JSON.stringify(commit.repo));
      commitList.splice(commitList.length, 0, newCommit);
      commitsCount--;
      if (commitsCount == 0) logger.debug('commits received:\n' + JSON.stringify(commitList));
    });
  };

  var commitListHandler = function (err, commits) {
    if (err) {
      return callback(err)
    }

    if (logInstrumentation) dumpCommitList(commits);

    if (commits.length < 1) sendOutput();

    commitsInProgress = commits.length;

    var markerCommit;

    commits.forEach(function (commit) {
        if (markerCommitFound) depthAchieved++;

        var parentPositionInParentsArray = parents.indexOf(commit.parents()[0].id);
        if (parentPositionInParentsArray < 0) {
          parents.push(commit.parents()[0].id);
        }

        var cmd, opt;

        if (markerCommitFound && shouldIncludeCommit(commit)) {
          //prepare to find out what files changed in this commit.
          cmd = 'git diff ' + commit.id + '..' + commit.parents()[0].id + ' --name-only';
          opt = {cwd: commit.repo.path};
        }
        else {
          cmd = 'echo \'\'';
          opt = {cwd: commit.repo.path};
        }

        logger.debug('preparing to issue command: ' + cmd);
        //asynchronously call diff command
        exec(cmd, opt, function execFn(err, stdout) {
          logger.debug('command output: ' + stdout);
          var files;

          if (err) {
            return callback(err)
          }

          if ('' != stdout.trim()) {
            files = stdout.split("\n").slice(0, -1);
            fixes.push(new Fix(commit.message.split("\n")[0], commit.committed_date, files));
          }

          logger.debug('fixes.count: ' + fixes.length);
          if (!markerCommitFound) {
            if (commit.id == markerCommitId) {
              markerCommit = commit;
            }
          }

          var commitIndexInParentsList = parents.indexOf(commit.id);

          if (commitIndexInParentsList > -1) {
            parents.splice(commitIndexInParentsList, 1);
          }

          commitsInProgress--;
          if (commitsInProgress <= 0) {
            logger.debug('parents.length: ' + parents.length);
            if (parents.length === 0 || depthAchieved === depth) {
              logger.debug('calling sendOutput()');
              sendOutput();
            } else {
              var remainingDepth = depth - depthAchieved;
              var depthToRetrieve = remainingDepth > batchSize ? batchSize : remainingDepth;
              if (!markerCommitFound && markerCommit) {
                parents = [markerCommit.id];
                markerCommitFound = true;
                logger.debug('marker commit found!');
              }
              logger.debug('depthAchieved: ' + depthAchieved);
              logger.debug('getting ' + depthToRetrieve + ' more commits: ' + JSON.stringify({
                commitId: parents[0],
                depthToRetrieve: depthToRetrieve
              }));
              repo.commits(parents[0], depthToRetrieve, commitListHandler)
            }
          }
        })
      }
    )
    ;
  };

  var headCommitHandler = function (err, head) {
    logger.debug('headCommitHandler entered. head:\n' + JSON.stringify(head));
    if (err) {
      return callback(err)
    }

    var depthToRetrieve = depth > batchSize ? batchSize : depth;
    logger.debug('getting commits: ' + JSON.stringify({commitId: head.commit.id, depthToRetrieve: depthToRetrieve}));
    repo.commits(head.commit.id, depthToRetrieve, commitListHandler);
  };

  if ('' == markerCommitId) {
    markerCommitFound = true;
  }
//retrieves the head commit for the branch
  logger.debug('calling repo.branch:\n' + JSON.stringify({branch: branch}));
  repo.branch(branch, headCommitHandler);
}
;
module.exports = Bugspots;

