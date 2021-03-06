/*
 * Copyright 2016 EPAM Systems
 *
 *
 * This file is part of EPAM Report Portal.
 * https://github.com/reportportal/service-ui
 *
 * Report Portal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Report Portal is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Report Portal.  If not, see <http://www.gnu.org/licenses/>.
 */

define(function (require, exports, module) {
    'use strict';

    var _ = require('underscore');
    var Moment = require('moment');

    var widgetPreviewService = {
        parseData: function (data, model) {
            var type = model.get('gadget');
            switch (type) {
            case 'old_line_chart':
                return this.getLineTrendChartData(data, model);
            case 'statistic_trend':
                return this.getLineTrendChartData(data, model);
            case 'investigated_trend':
                return this.getColumnChartData(data, model);
            case 'launch_statistics':
                return this.getCombinePieChartData(data, model);
            case 'overall_statistics':
                return this.getStaticticsPanelData(data, model);
            case 'not_passed':
                return this.getNotPassedChartData(data);
            case 'cases_trend':
                return this.getCasesTrendChartData(data, model);
            case 'bug_trend':
                return this.getBugsTrendChartData(data, model);
            case 'launches_comparison_chart':
                return this.getLaunchesComparisonChartData(data, model);
            case 'launches_duration_chart':
                return this.getLaunchesDurationChartData(data);
            default:
                return null;
            }
        },
        fixCriteria: function (type, key, issueType) {
            var execCount = 'statistics$executionCounter$';
            var issueCount = 'statistics$issueCounter$';

            if (type === 'defects') {
                if (issueType) {
                    var k = issueType.split('_');
                    if (k[1]) {
                        k[1] = k[1].capitalize();
                    }
                    return issueCount + k.join('') + '$' + key;
                }
                var d = key.split('_');
                if (d[1]) {
                    d[1] = d[1].capitalize();
                }
                return issueCount + d.join('');
            }
            return execCount + key;
        },
        calcValue: function (val) {
            var calc = 0;
            if (_.isObject(val)) {
                if (_.isUndefined(val.total)) {
                    _.each(val, function (v, k) {
                        calc += parseInt(v, 10);
                    });
                } else {
                    calc = parseInt(val.total, 10);
                }
            } else {
                calc = parseInt(val, 10);
            }
            return calc;
        },
        getValues: function (criteria, launch) {
            var values = {};
            _.each(criteria, function (c) {
                var k = c.split('$');
                var last = _.last(k);
                var type = k[1];
                var v = launch ? type === 'defects' ? launch[k[0]][type][k[2]][last] : launch[k[0]][type][last] : 0;
                var key = this.fixCriteria(type, last, k[2]);
                var val = this.calcValue(v || 0);
                values[key] = val;
            }, this);
            return values;
        },
        getLaunchInfo: function (launch) {
            return {
                name: launch.name,
                number: launch.number,
                startTime: launch.start_time
            };
        },
        getComparisonLaunches: function (data, revert) {
            var compare = [];
            var launches = data.content;
            for (var i = 0, length = launches.length; i < length; i++) {
                if (compare.length >= 2) {
                    break;
                }
                if (launches.status !== 'inProgress') {
                    compare.push(launches[i]);
                }
            }
            if (!revert) {
                compare.reverse();
            }
            return compare;
        },
        getStaticticsPanelData: function (data, model) {
            var content = {};
            var launches = data.content.reverse();
            var criteria = model.getContentFields();
            if (!_.isEmpty(launches)) {
                _.each(launches, function (launch) {
                    _.each(criteria, function (c) {
                        var k = c.split('$');
                        var type = k[1];
                        var key = _.last(k);
                        var v = launch ? type === 'defects' ? launch[k[0]][type][k[2]][key] : launch[k[0]][type][key] : 0;
                        var val = this.calcValue(v || 0);

                        if (content[key]) {
                            content[key] += val;
                        } else {
                            content[key] = val;
                        }
                    }, this);
                }, this);
            }
            return { result: [{ values: content }] };
        },
        getLineTrendChartData: function (data, model) {
            var content = {};
            var isTimelineMode = model.get('isTimeline');
            var launches = data.content.reverse();
            var criteria = model.getContentFields();

            if (!_.isEmpty(launches)) {
                if (!isTimelineMode) {
                    content.result = [];
                    _.each(launches, function (launch) {
                        var info = this.getLaunchInfo(launch);
                        info.values = this.getValues(criteria, launch);
                        content.result.push(info);
                    }, this);
                } else {
                    var dates = [];
                    _.each(launches, function (launch) {
                        var values = this.getValues(criteria, launch);
                        var time = Moment(launch.start_time).format('YYYY-MM-DD');
                        dates.push(Moment(time, 'YYYY-MM-DD').unix());
                        if (content.hasOwnProperty(time)) {
                            var d = content[time][0].values;
                            _.each(d, function (v, k) {
                                d[k] = v + values[k];
                            });
                        } else {
                            content[time] = [{ values: values }];
                        }
                    }, this);
                    var minDate = _.min(dates);
                    var maxDate = _.max(dates);
                    var currentDate = Moment.unix(minDate).format('YYYY-MM-DD');
                    var zero = this.getValues(criteria);
                    while (Moment(currentDate, 'YYYY-MM-DD').unix() < maxDate) {
                        currentDate = Moment(currentDate, 'YYYY-MM-DD').add(1, 'd').format('YYYY-MM-DD');
                        if (!content.hasOwnProperty(currentDate)) {
                            content[currentDate] = [{ values: zero }];
                        }
                    }
                }
            }
            return content;
        },
        getColumnChartData: function (data, model) {
            var content = {};
            var isTimelineMode = model.get('isTimeline');
            var criteria = model.getContentFields();
            var self = this;
            var launches = data.content.reverse();
            var getStatsData = function (crt, stats) {
                var total = 0;
                var inv = 0;
                var toInv = 0;

                _.each(crt, function (c) {
                    var arr = c.split('$');
                    var type = arr[2];
                    var def = _.last(arr);
                    if (_.has(stats.defects[type], def)) {
                        var val = stats.defects[type][def];
                        var calc = self.calcValue(val);
                        if (type === 'to_investigate') {
                            toInv += calc;
                        } else {
                            inv += calc;
                        }
                        total += calc;
                    }
                }, this);
                return {
                    total: total,
                    inv: inv,
                    to_inv: toInv
                };
            };

            if (!_.isEmpty(launches)) {
                if (!isTimelineMode) {
                    content.result = [];
                    _.each(launches, function (launch) {
                        var launchInfo = this.getLaunchInfo(launch);
                        var stats = launch.statistics;
                        var statsData = getStatsData(criteria, stats);
                        var total = statsData.total;
                        var inv = statsData.inv;
                        var toInv = statsData.to_inv;

                        launchInfo.values = {
                            investigated: total ? Math.round(((inv / total) * 100) * 100) / 100 : 0,
                            to_investigate: total ? Math.round(((toInv / total) * 100) * 100) / 100 : 0
                        };
                        content.result.push(launchInfo);
                    }, this);
                } else {
                    var dates = [];
                    var days = {};
                    _.each(launches, function (launch) {
                        var time = Moment(launch.start_time).format('YYYY-MM-DD');
                        var stats = launch.statistics;
                        var statsData = getStatsData(criteria, stats);
                        var total = statsData.total;
                        var inv = statsData.inv;
                        var toInv = statsData.to_inv;

                        dates.push(Moment(time, 'YYYY-MM-DD').unix());

                        if (days.hasOwnProperty(time)) {
                            var d = days[time];
                            d.total += total;
                            d.to_investigate += toInv;
                            d.investigated += inv;
                        } else {
                            days[time] = {
                                total: total,
                                to_investigate: toInv,
                                investigated: inv
                            };
                        }
                    }, this);
                    var minDate = _.min(dates);
                    var maxDate = _.max(dates);
                    var currentDate = Moment.unix(minDate).format('YYYY-MM-DD');

                    while (Moment(currentDate, 'YYYY-MM-DD').unix() < maxDate) {
                        currentDate = Moment(currentDate, 'YYYY-MM-DD').add(1, 'd').format('YYYY-MM-DD');
                        if (!days.hasOwnProperty(currentDate)) {
                            days[currentDate] = { total: 0, to_investigate: 0, investigated: 0 };
                        }
                    }
                    _.each(days, function (val, key) {
                        var total = val.total;
                        var inv = val.investigated;
                        var toInv = val.to_investigate;
                        var values = {
                            investigated: total ? Math.round(((inv / total) * 100) * 100) / 100 : 0,
                            to_investigate: total ? Math.round(((toInv / total) * 100) * 100) / 100 : 0
                        };
                        content[key] = [{ values: values }];
                    }, this);
                }
            }
            return content;
        },
        getLaunchesDurationChartData: function (data) {
            var content = { result: [] };
            var launches = data.content.reverse();

            _.each(launches, function (launch) {
                var launchInfo = this.getLaunchInfo(launch);
                launchInfo.values = {
                    status: launch.status,
                    start_time: launch.start_time,
                    end_time: launch.end_time,
                    duration: launch.end_time - launch.start_time
                };
                content.result.push(launchInfo);
            }, this);
            return content;
        },
        getLaunchesComparisonChartData: function (data, model) {
            var content = {};
            var launches = data.content;
            var criteries = _.map(model.getContentFields(), function (k) {
                var cArr = k.split('$');
                return cArr[2];
            });

            if (!_.isEmpty(launches)) {
                content.result = [];
                _.each(launches, function (launch) {
                    var launchInfo = this.getLaunchInfo(launch);
                    var stats = {};
                    _.each(launch.statistics, function (val, key) {
                        var total = _.reduce(val, function (memo, v, k) {
                            var val = this.calcValue(v);
                            return (k !== 'total' && _.contains(criteries, k)) ? memo + val : memo;
                        }, 0, this);

                        _.each(val, function (v, k) {
                            if (k !== 'total' && _.contains(criteries, k)) {
                                var value = this.calcValue(v);
                                var s = total ? Math.round(((value / total) * 100) * 100) / 100 : 0;
                                stats[this.fixCriteria(key, k)] = s;
                            }
                        }, this);
                        launchInfo.values = stats;
                    }, this);

                    content.result.push(launchInfo);
                }, this);
            }
            return content;
        },
        getNotPassedChartData: function (data) {
            var content = {};
            var launches = data.content.reverse();

            if (!_.isEmpty(launches)) {
                content.result = [];
                _.each(launches, function (launch) {
                    var launchInfo = this.getLaunchInfo(launch);
                    var stats = launch.statistics;
                    var exec = stats.executions;
                    var total = parseInt(exec.total, 10);
                    var fail = parseInt(exec.failed, 10);
                    var skip = parseInt(exec.skipped, 10);
                    var val = total ? Math.round((((fail + skip) / total) * 100) * 100) / 100 : 0;
                    launchInfo.values = { '% (Failed+Skipped)/Total': val };
                    content.result.push(launchInfo);
                }, this);
            }
            return content;
        },
        getBugsTrendChartData: function (data, model) {
            var content = {};
            var launches = data.content.reverse();
            var criteria = model.getContentFields();
            var prev = 0;

            if (!_.isEmpty(launches)) {
                content.result = [];
                _.each(launches, function (launch) {
                    var launchInfo = this.getLaunchInfo(launch);
                    var stats = launch.statistics;
                    var defects = stats.defects;
                    var values = {};
                    var total = 0;

                    _.each(criteria, function (c) {
                        var arr = c.split('$');
                        var def = arr[2];
                        var val = defects[def];
                        var calc = this.calcValue(val);
                        total += calc;
                        values[this.fixCriteria(c)] = calc;
                    }, this);

                    values.issuesCount = total;
                    values.delta = total - prev;
                    launchInfo.values = values;
                    prev = total;
                    content.result.push(launchInfo);
                }, this);
            }
            return content;
        },
        getCasesTrendChartData: function (data, model) {
            var content = {};
            var launches = data.content.reverse();
            var isTimelineMode = model.get('isTimeline');
            var criteria = 'total';
            var getTotal = function (launch) {
                var stats = launch.statistics;
                var exec = stats.executions;
                var total = parseInt(exec.total, 10);
                return total;
            };

            if (!_.isEmpty(launches)) {
                if (!isTimelineMode) {
                    var prev = 0;
                    content.result = [];
                    _.each(launches, function (launch, i) {
                        var launchInfo = this.getLaunchInfo(launch);
                        var total = getTotal(launch);
                        var addValue = (i === 0) ? 0 : total - prev;
                        prev = total;
                        launchInfo.values = {};
                        launchInfo.values[this.fixCriteria('executions', criteria)] = total;
                        launchInfo.values.delta = addValue;
                        content.result.push(launchInfo);
                    }, this);
                } else {
                    var dates = [];
                    var days = {};
                    _.each(launches, function (launch) {
                        var time = Moment(launch.start_time).format('YYYY-MM-DD');
                        var total = getTotal(launch);
                        var val = { total: total, time: Moment(time, 'YYYY-MM-DD').unix() };

                        if (days.hasOwnProperty(time)) {
                            var item = days[time];
                            var t = item.total;
                            if (total > t) {
                                days[time] = val;
                            }
                        } else {
                            days[time] = val;
                            dates.push(Moment(time, 'YYYY-MM-DD').unix());
                        }
                    }, this);

                    var minDate = _.min(dates);
                    var maxDate = _.max(dates);
                    var currentDate = Moment.unix(minDate).format('YYYY-MM-DD');
                    while (Moment(currentDate, 'YYYY-MM-DD').unix() < maxDate) {
                        currentDate = Moment(currentDate, 'YYYY-MM-DD').add(1, 'd').format('YYYY-MM-DD');
                        if (!days.hasOwnProperty(currentDate)) {
                            days[currentDate] = { total: 0, time: Moment(currentDate, 'YYYY-MM-DD').unix() };
                        }
                    }
                    var values = _.values(days);
                    var prev = 0;
                    values.sort(function (a, b) {
                        return a.time - b.time;
                    });

                    _.each(values, function (item, i) {
                        var time = Moment.unix(item.time).format('YYYY-MM-DD');
                        var total = item.total;
                        var addVal = (i === 0) ? 0 : total - prev;
                        var val = {};
                        val[this.fixCriteria('executions', criteria)] = total;
                        val.delta = addVal;
                        content[time] = [{ values: val }];
                        prev = total;
                    }, this);
                }
            }
            return content;
        },
        getCombinePieChartData: function (data, model) {
            var content = {};
            var launches = data.content.reverse();
            var launch = _.last(launches);
            var criteries = model.getContentFields();
            if (launch) {
                var launchInfo = this.getLaunchInfo(launch);
                content.result = [];
                launchInfo.values = {};
                _.each(criteries.reverse(), function (c) {
                    var cArr = c.split('$');
                    var type = cArr[1];
                    var defect = _.last(cArr);
                    var val = (launch.statistics && launch.statistics[type]) ? type === 'defects' ? launch.statistics[type][cArr[2]][defect] : launch.statistics[type][defect] : 0;
                    var calc = this.calcValue(val || 0);
                    launchInfo.values[this.fixCriteria(type, defect, cArr[2])] = calc;
                }, this);

                content.result.push(launchInfo);
            }
            return content;
        }
    };

    return widgetPreviewService;
});

