/*
 * Copyright (c) 2012-2013 VMware, Inc. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

(function (buster, define) {
	'use strict';

	var assert, fail, failOnThrow, undef;

	assert = buster.assertions.assert;
	fail = buster.assertions.fail;
	failOnThrow = buster.assertions.failOnThrow;

	define('rest/interceptor/retry-test', function (require) {

		var interceptor, retry, rest, when, delay, clock, timeout;

		interceptor = require('rest/interceptor');
		retry = require('rest/interceptor/retry');
		rest = require('rest');
		when = require('when');
		delay = require('when/delay');

		// retain access to the native setTimeout function
		timeout = setTimeout;

		buster.testCase('rest/interceptor/retry', {
			'should retry until successful': function (done) {
				var count = 0, client = retry(
					function (request) {
						count += 1;
						if (count === 2) {
							return { request: request, status: { code: 200 } };
						} else {
							return when.reject({ request: request, error: 'Thrown by fake client' });
						}
					}
				);
				client({}).then(function (response) {
				    assert.equals(200, response.status.code);
				}).then(undef, fail).always(done);
			},
			'should accept custom config': {
				setUp: function () {
					clock = this.useFakeTimers();
				},
				tearDown: function () {
					clock.restore();
				},
				'': function (done) {
					var count = 0, client, start, config;

					start = new Date().getTime();
					config = { initial: 10, multiplier: 3, max: 20 };
					client = retry(
						function (request) {
							var tick = Math.min(Math.pow(config.multiplier, count) * config.initial, config.max);
							count += 1;
							if (count === 4) {
								return { request: request, status: { code: 200 } };
							} else {
								timeout(function () {
									clock.tick(tick);
									console.log('now: ', new Date().getTime() - start);
								}, 0);
								return when.reject({ request: request, error: 'Thrown by fake client' });
							}
						},
						config
					);

					client({}).then(function (response) {
						assert.equals(200, response.status.code);
					    assert.equals(count, 4);
						assert.equals(50, new Date().getTime() - start);
					}).then(undef, fail).always(done);
				}
			},
			'should not make propagate request if marked as canceled': function (done) {
				var parent, client, request;

				parent = this.spy(function (request) {
					return when.reject({ request: request });
				});
				client = retry(parent, { initial: 10 });

				request = {};
				client(request).then(
					fail,
					failOnThrow(function (response) {
						assert(request.canceled);
						assert.equals('precanceled', response.error);
						assert.same(1, parent.callCount);
					})
				).always(done);

				request.canceled = true;
			},
			'should have the default client as the parent by default': function () {
				assert.same(rest, retry().skip());
			},
			'should support interceptor chaining': function () {
				assert(typeof retry().chain === 'function');
			}
		});

	});

}(
	this.buster || require('buster'),
	typeof define === 'function' && define.amd ? define : function (id, factory) {
		var packageName = id.split(/[\/\-]/)[0], pathToRoot = id.replace(/[^\/]+/g, '..');
		pathToRoot = pathToRoot.length > 2 ? pathToRoot.substr(3) : pathToRoot;
		factory(function (moduleId) {
			return require(moduleId.indexOf(packageName) === 0 ? pathToRoot + moduleId.substr(packageName.length) : moduleId);
		});
	}
	// Boilerplate for AMD and Node
));
