angular.module('ngVis', [])

.factory('VisDataSet', function() {
  'use strict';
  return function(data, options) {
    // Create the new dataSets
    return new vis.DataSet(data, options);
  };
})

/**
* TimeLine directive
*/
.directive('visTimeline', function() {
  'use strict';
  return {
    restrict: 'EA',
    transclude: false,
    scope: {
      data: '=',
      options: '=',
      events: '='
    },
    link: function(scope, element, attr) {
      var timelineEvents = [
        'rangechange',
        'rangechanged',
        'timechange',
        'timechanged',
        'select',
        'doubleClick',
        'click',
        'contextmenu'
      ];

      // Declare the timeline
      var timeline = null;

      scope.$watch('data', function() {
        // Sanity check
        if (scope.data == null) {
          return;
        }

        // If we've actually changed the data set, then recreate the graph
        // We can always update the data by adding more data to the existing data set
        if (timeline != null) {
          timeline.destroy();
        }

        // Create the timeline object
        timeline = new vis.Timeline(element[0], scope.data.items, scope.data.groups, scope.options);

        // Attach an event handler if defined
        angular.forEach(scope.events, function(callback, event) {
          if (timelineEvents.indexOf(String(event)) >= 0) {
            timeline.on(event, callback);
          }
        });

        // onLoad callback
        if (scope.events != null && scope.events.onload != null && angular.isFunction(scope.events.onload)) {
          scope.events.onload(timeline);
        }
      });

      scope.$watchCollection('options', function(options) {
        if (timeline == null) {
          return;
        }
        timeline.setOptions(options);
      });
    }
  };
})

/**
* Directive for network chart.
*/
.directive('visNetwork', function() {
  return {
    restrict: 'EA',
    templateUrl: 'libs/angular-visjs/network.html',
    transclude: false,
    scope: {
      data: '=',
      options: '=',
      events: '=',
      manipulation: '=?',
      search: '=?'
    },
    link: function(scope, element, attr) {
      var networkEvents = [
        'click',
        'doubleClick',
        'oncontext',
        'hold',
        'release',
        'selectNode',
        'selectEdge',
        'deselectNode',
        'deselectEdge',
        'dragStart',
        'dragging',
        'dragEnd',
        'hoverNode',
        'hoverEdge',
        'blurNode',
        'blurEdge',
        'zoom',
        'showPopup',
        'hidePopup',
        'startStabilizing',
        'stabilizationProgress',
        'stabilizationIterationsDone',
        'stabilized',
        'resize',
        'initRedraw',
        'beforeDrawing',
        'afterDrawing',
        'animationFinished'
      ];

      var container = document.getElementById('arch-vis-network');
      var network = null;
      var group1Clusters = [];
      var focusOptions = {
        scale: 1,
        animation: {
          easingFunction: 'easeInCubic'
        }
      };

      scope.showEditNode = false;
      scope.showEditEdge = false;
      scope.showDelete = false;
      scope.showBack = false;
      scope.showSearch = false;
      scope.filterString = '';

      scope.$watch('data', function() {
        // Sanity check
        if (scope.data == null) {
          return;
        }

        // If we've actually changed the data set, then recreate the graph
        // We can always update the data by adding more data to the existing data set
        if (network != null) {
          network.destroy();
        }

        // Create the network object
        network = new vis.Network(container, scope.data, scope.options);

        // Scan all the nodes and populate the cluster array with all the available groups
        angular.forEach(scope.data.nodes, function(node) {
          if (node.group1 && group1Clusters.indexOf(node.group1) == -1) {
            group1Clusters.push(node.group1);
          }
        });

        // Create the network clusters
        makeClusters();

        // Attach an event handler if defined
        angular.forEach(scope.events, function(callback, event) {
          if (networkEvents.indexOf(String(event)) >= 0) {
            network.on(event, callback);
          }
        });

        // onLoad callback
        if (scope.events != null && scope.events.onload != null && angular.isFunction(scope.events.onload)) {
          scope.events.onload(network);
        }

        // On nodes or edges selection manage the optional buttons
        network.on("select", function(params) {
          // if the clicked element is a cluster, open it...
          if (params.nodes.length == 1 && network.isCluster(params.nodes[0])) {
            network.openCluster(params.nodes[0])
          }
          // ...if one edge is selected and no nodes are selected, show the edit and the delete edge button...
          else if (params.edges.length == 1 && params.nodes.length == 0) {
            scope.showEditNode = false;
            scope.showEditEdge = true;
            scope.showDelete = true;
          }
          // ...if at least one node is selected, show the edit and the delete node button...
          else if (params.nodes.length > 0) {
            scope.showEditNode = true;
            scope.showEditEdge = false;
            scope.showDelete = true;
          }
          // ...otherwise hide all the optional buttons
          else {
            scope.showEditNode = false;
            scope.showEditEdge = false;
            scope.showDelete = false;
          }
        });

        // When the zooms out recreate all the clusters
        network.on('zoom', function(params) {
          if (params.scale < 1) {
            makeClusters();
          }
        });
      });

      scope.$watchCollection('options', function(options) {
        if (network == null) {
          return;
        }
        network.setOptions(options);
      });

      // watch the attribute filterString to zoom on the searched node when it changes
      scope.$watch('filterString', function(filterString) {
        if (network && filterString) {
          network.focus(filterString, focusOptions);
        }
      });

      // function invoked when the user clicks on the search button
      scope.searchNode = function() {
        scope.filterString = '';
        scope.showSearch = true;
        scope.showBack = true;
        scope.backHint = '';
      };

      // function invoked when the user clicks on the back button
      scope.back = function() {
        network.disableEditMode();
        scope.showBack = false;
      };

      // function invoked when the user clicks on the add node button
      scope.addNode = function() {
        network.addNodeMode();
        scope.showBack = true;
        scope.showSearch = false;
        scope.showEditNode = false;
        scope.showEditEdge = false;
        scope.showDelete = false;
        scope.backHint = 'Click in an empty space to place a new node';
      };

      // function invoked when the user clicks on the add edge button
      scope.addEdge = function() {
        network.addEdgeMode();
        scope.showBack = true;
        scope.showSearch = false;
        scope.showEditNode = false;
        scope.showEditEdge = false;
        scope.showDelete = false;
        scope.backHint = 'Click on a node and drag the edge to another node to connect them';
      };

      // function invoked when the user clicks on the edit node button
      scope.editNode = function() {
        network.editNode();
      };

      // function invoked when the user clicks on the edit edge button
      scope.editEdge = function() {
        network.editEdgeMode();
      };

      // function invoked when the user clicks on the delete button
      scope.delete = function() {
        network.deleteSelected();
        scope.showEditNode = false;
        scope.showEditEdge = false;
        scope.showDelete = false;
      };

      // Create node clusters accoding to the available groups
      function makeClusters() {
        for (var i = 0; i < group1Clusters.length; i++) {
          var clusterOptions = {
            joinCondition: function(nodeOptions) {
              return nodeOptions.group1 === group1Clusters[i];
            },
            clusterNodeProperties: {
              id: 'cluster_' + group1Clusters[i],
              label: group1Clusters[i],
              shape: 'circle',
              margin: 10,
              color: 'rgb(0,87,126)',
              font: {
                color: 'white'
              }
            }
          };

          network.cluster(clusterOptions);
        }
      }
    }
  };
})

/**
* Directive for graph2d.
*/
.directive('visGraph2d', function() {
  'use strict';
  return {
    restrict: 'EA',
    transclude: false,
    scope: {
      data: '=',
      options: '=',
      events: '='
    },
    link: function(scope, element, attr) {
      var graphEvents = [
        'rangechange',
        'rangechanged',
        'timechange',
        'timechanged',
        'finishedRedraw'
      ];

      // Create the chart
      var graph = null;

      scope.$watch('data', function() {
        // Sanity check
        if (scope.data == null) {
          return;
        }

        // If we've actually changed the data set, then recreate the graph
        // We can always update the data by adding more data to the existing data set
        if (graph != null) {
          graph.destroy();
        }

        // Create the graph2d object
        graph = new vis.Graph2d(element[0], scope.data.items, scope.data.groups, scope.options);

        // Attach an event handler if defined
        angular.forEach(scope.events, function(callback, event) {
          if (graphEvents.indexOf(String(event)) >= 0) {
            graph.on(event, callback);
          }
        });

        // onLoad callback
        if (scope.events != null && scope.events.onload != null && angular.isFunction(scope.events.onload)) {
          scope.events.onload(graph);
        }
      });

      scope.$watchCollection('options', function(options) {
        if (graph == null) {
          return;
        }
        graph.setOptions(options);
      });
    }
  };
});
