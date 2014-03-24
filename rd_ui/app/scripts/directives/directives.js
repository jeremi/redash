(function() {
    'use strict';

    var directives = angular.module('redash.directives', []);

    directives.directive('alertUnsavedChanges', ['$window', function($window) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                'isDirty': '='
            },
            link: function($scope) {
                var

                unloadMessage = "You will lose your changes if you leave",
                confirmMessage = unloadMessage + "\n\nAre you sure you want to leave this page?",

                // store original handler (if any)
                _onbeforeunload = $window.onbeforeunload;

                $window.onbeforeunload = function() {
                    return $scope.isDirty ? unloadMessage : null;
                }

                $scope.$on('$locationChangeStart', function(event, next, current) {
                  if (next.split("#")[0] == current.split("#")[0]) {
                    return;
                  }

                  if ($scope.isDirty && !confirm(confirmMessage)) {
                    event.preventDefault();
                  }
                });

                $scope.$on('$destroy', function() {
                    $window.onbeforeunload = _onbeforeunload;
                });
            }
        }
    }]);

    directives.directive('keyboardShortcut', function() {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                key: '@',
                action: '='
            },
            link: function($scope) {
                Mousetrap.bindGlobal($scope.key, function(e) {
                    e.preventDefault();
                    $scope.action();
                });

                $scope.$on('$destroy', function() {
                    Mousetrap.unbind($scope.key);
                });
            }
        }
    });

    directives.directive('rdTab', function() {
        return {
            restrict: 'E',
            scope: {
                'tabId': '@',
                'name': '@'
            },
            transclude: true,
            template: '<li class="rd-tab" ng-class="{active: tabId==selectedTab}"><a href="#{{tabId}}">{{name}}<span ng-transclude></span></a></li>',
            replace: true,
            link: function(scope) {
                scope.$watch(function(){return scope.$parent.selectedTab}, function(tab) {
                    scope.selectedTab = tab;
                });
            }
        }
    });

    directives.directive('rdTabs', ['$location', function($location) {
        return {
            restrict: 'E',
            scope: {
                tabsCollection: '=',
                selectedTab: '='
            },
            template: '<ul class="nav nav-tabs"><li ng-class="{active: tab==selectedTab}" ng-repeat="tab in tabsCollection"><a href="#{{tab.key}}">{{tab.name}}</a></li></ul>',
            replace: true,
            link: function($scope, element, attrs) {
                $scope.selectTab = function(tabKey) {
                    $scope.selectedTab  = _.find($scope.tabsCollection, function(tab) { return tab.key == tabKey; });
                }

                $scope.$watch(function() { return $location.hash()}, function(hash) {
                    if (hash) {
                        $scope.selectTab($location.hash());
                    } else {
                        $scope.selectTab($scope.tabsCollection[0].key);
                    }
                });
            }
        }
    }]);

    directives.directive('editDashboardForm', ['$http', '$location', '$timeout', 'Dashboard', function($http, $location, $timeout, Dashboard) {
        return {
            restrict: 'E',
            scope: {
                dashboard: '='
            },
            templateUrl: '/views/edit_dashboard.html',
            replace: true,
            link: function($scope, element, attrs) {
                var gridster = element.find(".gridster ul").gridster({
                    widget_margins: [5, 5],
                    widget_base_dimensions: [260, 100],
                    min_cols: 2,
                    max_cols: 2,
                    serialize_params: function($w, wgd) {
                        return {
                            col: wgd.col,
                            row: wgd.row,
                            id: $w.data('widget-id')
                        }
                    }
                }).data('gridster');

                var gsItemTemplate = '<li data-widget-id="{id}" class="widget panel panel-default gs-w">' +
                                 '<div class="panel-heading">{name}' +
                                 '</div></li>';

                $scope.$watch('dashboard.widgets', function(widgets) {
                    $timeout(function () {
                        gridster.remove_all_widgets();

                        if (widgets && widgets.length) {
                            var layout = [];

                            _.each(widgets, function(row, rowIndex) {
                                _.each(row, function(widget, colIndex) {
                                    layout.push({
                                        id: widget.id,
                                        col: colIndex+1,
                                        row: rowIndex+1,
                                        ySize: 1,
                                        xSize: widget.width,
                                        name: widget.visualization.query.name
                                    });
                                });
                            });

                            _.each(layout, function(item) {
                                var el = gsItemTemplate.replace('{id}', item.id).replace('{name}', item.name);
                                gridster.add_widget(el, item.xSize, item.ySize, item.col, item.row);

                            });
                        }
                    });
                }, true);

                $scope.saveDashboard = function() {
                    $scope.saveInProgress = true;
                    // TODO: we should use the dashboard service here.
                    if ($scope.dashboard.id) {
                        var positions = $(element).find('.gridster ul').data('gridster').serialize();
                        var layout = [];
                        _.each(_.sortBy(positions, function (pos) {
                            return pos.row * 10 + pos.col;
                        }), function (pos) {
                            var row = pos.row - 1;
                            var col = pos.col - 1;
                            layout[row] = layout[row] || [];
                            if (col > 0 && layout[row][col - 1] == undefined) {
                                layout[row][col - 1] = pos.id;
                            } else {
                                layout[row][col] = pos.id;
                            }

                        });
                        $scope.dashboard.layout = layout;

                        layout = JSON.stringify(layout);
                        $http.post('/api/dashboards/' + $scope.dashboard.id, {'name': $scope.dashboard.name, 'layout': layout}).success(function(response) {
                            $scope.dashboard = new Dashboard(response);
                            $scope.saveInProgress = false;
                            $(element).modal('hide');
                        })
                    } else {
                        $http.post('/api/dashboards', {'name': $scope.dashboard.name}).success(function(response) {
                            $(element).modal('hide');
                            $location.path('/dashboard/' + response.slug).replace();
                        })
                    }
                }

            }
        }
    }]);

    directives.directive('newWidgetForm', ['$http', 'Query', function($http, Query) {
        return {
            restrict: 'E',
            scope: {
                dashboard: '='
            },
            templateUrl: '/views/new_widget_form.html',
            replace: true,
            link: function($scope, element, attrs) {
                $scope.widgetSizes = [{name: 'Regular', value: 1}, {name: 'Double', value: 2}];

                var reset = function() {
                    $scope.saveInProgress = false;
                    $scope.widgetSize = 1;
                    $scope.queryId = null;
                    $scope.selectedVis = null;
                    $scope.query = null;

                }

                reset();

                $scope.loadVisualizations = function() {
                    if (!$scope.queryId) {
                        return;
                    }

                    Query.get({
                        id: $scope.queryId
                    }, function(query) {
                        if (query) {
                            $scope.query = query;
                            if(query.visualizations.length) {
                                $scope.selectedVis = query.visualizations[0];
                            }
                        }
                    });
                };

                $scope.saveWidget = function() {
                    $scope.saveInProgress = true;

                    var widget = {
                        'visualization_id': $scope.selectedVis.id,
                        'dashboard_id': $scope.dashboard.id,
                        'options': {},
                        'width': $scope.widgetSize
                    }

                    $http.post('/api/widgets', widget).success(function(response) {
                        // update dashboard layout
                        $scope.dashboard.layout = response['layout'];
                        if (response['new_row']) {
                            $scope.dashboard.widgets.push([response['widget']]);
                        } else {
                            $scope.dashboard.widgets[$scope.dashboard.widgets.length-1].push(response['widget']);
                        }

                        // close the dialog
                        $('#add_query_dialog').modal('hide');
                        reset();
                    })
                }

            }
        }
    }])

    // From: http://jsfiddle.net/joshdmiller/NDFHg/
    directives.directive('editInPlace', function () {
        return {
            restrict: 'E',
            scope: {
                value: '=',
                ignoreBlanks: '=',
                editable: '=',
                done: '='
            },
            template: function(tElement, tAttrs) {
                var elType = tAttrs.editor || 'input';
                var placeholder = tAttrs.placeholder || 'Click to edit';
                return '<span ng-click="editable && edit()" ng-bind="value" ng-class="{editable: editable}"></span>' +
                       '<span ng-click="editable && edit()" ng-show="editable && !value" ng-class="{editable: editable}">' + placeholder + '</span>' +
                       '<{elType} ng-model="value" class="rd-form-control"></{elType}>'.replace('{elType}', elType);
            },
            link: function ($scope, element, attrs) {
                // Let's get a reference to the input element, as we'll want to reference it.
                var inputElement = angular.element(element.children()[2]);

                // This directive should have a set class so we can style it.
                element.addClass('edit-in-place');

                // Initially, we're not editing.
                $scope.editing = false;

                // ng-click handler to activate edit-in-place
                $scope.edit = function () {
                    $scope.oldValue = $scope.value;

                    $scope.editing = true;

                    // We control display through a class on the directive itself. See the CSS.
                    element.addClass('active');

                    // And we must focus the element.
                    // `angular.element()` provides a chainable array, like jQuery so to access a native DOM function,
                    // we have to reference the first element in the array.
                    inputElement[0].focus();
                };

                function save() {
                    if ($scope.editing) {
                        if ($scope.ignoreBlanks && _.isEmpty($scope.value)) {
                            $scope.value = $scope.oldValue;
                        }
                        $scope.editing = false;
                        element.removeClass('active');

                        if ($scope.value !== $scope.oldValue) {
                            $scope.done && $scope.done();
                        }
                    }
                }

                $(inputElement).keydown(function(e) {
                    // 'return' or 'enter' key pressed
                    // allow 'shift' to break lines
                    if (e.which === 13 && !e.shiftKey) {
                        save();
                    } else if (e.which === 27) {
                        $scope.value = $scope.oldValue;
                        $scope.$apply(function() {
                            $(inputElement[0]).blur();
                        });
                    }
                }).blur(function() {
                    save();
                });
            }
        };
    });

    // http://stackoverflow.com/a/17904092/1559840
    directives.directive('jsonText', function() {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function(scope, element, attr, ngModel) {
              function into(input) {
                return JSON.parse(input);
              }
              function out(data) {
                return JSON.stringify(data, undefined, 2);
              }
              ngModel.$parsers.push(into);
              ngModel.$formatters.push(out);

            }
        };
    });

    directives.directive('rdTimer', [function () {
        return {
            restrict: 'E',
            scope: { timestamp: '=' },
            template: '{{currentTime}}',
            controller: ['$scope' ,function ($scope) {
                $scope.currentTime = "00:00:00";

                // We're using setInterval directly instead of $timeout, to avoid using $apply, to
                // prevent the digest loop being run every second.
                var currentTimer = setInterval(function() {
                    $scope.currentTime = moment(moment() - moment($scope.timestamp)).utc().format("HH:mm:ss");
                    $scope.$digest();
                }, 1000);

                $scope.$on('$destroy', function () {
                    if (currentTimer) {
                        clearInterval(currentTimer);
                        currentTimer = null;
                    }
                });
            }]
        };
    }]);

    directives.directive('rdTimeAgo', function() {
        return {
            restrict: 'E',
            scope: {
                value: '='
            },
            template: '<span>' +
                        '<span ng-show="value" am-time-ago="value"></span>' +
                        '<span ng-hide="value">-</span>' +
                      '</span>'
        }
    });
})();