/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */


var nodeunit = require('nodeunit');

var EventTarget = require('eventtarget');

var RpcBuilder = require("..");
var packer = RpcBuilder.packers.JsonRPC;


const METHOD = 'test';


function noop(error, result){};


exports['encode JsonRPC 2.0'] =
{
  setUp: function(callback)
  {
    this.rpcBuilder = new RpcBuilder(packer);

    callback();
  },

  tearDown: function(callback)
  {
    this.rpcBuilder.close();

    callback();
  },


  'notification': function(test)
  {
    test.expect(5);

    var notification = this.rpcBuilder.encode(METHOD);

    test.deepEqual(JSON.parse(notification),
    {
      jsonrpc: '2.0',
      method: METHOD
    });

    // Test notification
    notification = this.rpcBuilder.decode(notification);

    test.ok(notification instanceof RpcBuilder.RpcNotification);
    test.equal(notification.duplicate, undefined);

    test.equal(notification.method, METHOD);
    test.deepEqual(notification.params, {});

    test.done();
  },

  'request': function(test)
  {
    test.expect(5);

    var request = this.rpcBuilder.encode(METHOD, noop);

    test.deepEqual(JSON.parse(request),
    {
      jsonrpc: '2.0',
      method: METHOD,
      id: 0
    });

    // Test request
    request = this.rpcBuilder.decode(request);

    test.ok(request instanceof RpcBuilder.RpcNotification);
    test.equal(request.duplicated, false);

    test.equal(request.method, METHOD);
    test.deepEqual(request.params, {});

    test.done();
  },

  'request timeout': function(test)
  {
    test.expect(2);

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      test.notEqual(error, undefined);
      test.deepEqual(error.request, request);

      test.done();
    });
  },

  'request timeout and retry': function(test)
  {
    var self = this;

    test.expect(4);

    var gotError = false;

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      if(!gotError)
      {
        gotError = true;

        test.notEqual(error, undefined);
        test.deepEqual(error.request, request);

        var request2 = error.retry();

        test.deepEqual(request2, request);

        // Process request on 'server'
        request2 = self.rpcBuilder.decode(request2);
        var response = request2.reply();

        // Process response by 'client'
        self.rpcBuilder.decode(response);
      }

      else
      {
        test.equal(error, undefined);

        test.done();
      }
    });
  },

  'cancel request': function(test)
  {
    test.expect(0);

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      test.ifError(error);
    });

    this.rpcBuilder.cancel(request);

    setTimeout(function()
    {
      test.done();
    }, 6*1000)
  },

  'duplicated request': function(test)
  {
    test.expect(3);

    var request = this.rpcBuilder.encode(METHOD, noop);

    // Test request
    var request1 = this.rpcBuilder.decode(request);
    test.equal(request1.duplicated, false);

    var reply1 = request1.reply(null, null);

    var request2 = this.rpcBuilder.decode(request);
    test.equal(request2.duplicated, true);

    var reply2 = request2.reply();

    test.deepEqual(reply1, reply2);

    test.done();
  },

  'duplicated request with transport': function(test)
  {
    test.expect(2);

    var request = this.rpcBuilder.encode(METHOD, noop);

    // Test request
    var request1 = this.rpcBuilder.decode(request);
    test.equal(request1.duplicated, false);

    var reply1 = request1.reply(null, null);

    var request2 = this.rpcBuilder.decode(request, function(reply2)
    {
      test.deepEqual(reply1, reply2);

      test.done();
    });
    test.equal(request2, undefined);
  },

  'override duplicated request': function(test)
  {
    test.expect(4);

    var request = this.rpcBuilder.encode(METHOD, noop);

    // Test request
    var request1 = this.rpcBuilder.decode(request);
    test.equal(request1.duplicated, false);

    var reply1 = request1.reply(null, null);

    var request2 = this.rpcBuilder.decode(request);
    test.equal(request2.duplicated, true);

    var reply2 = request2.reply(null, 'ok');

    test.equal(JSON.parse(reply1).result, null);
    test.equal(JSON.parse(reply2).result, 'ok');

    test.done();
  },

  'response': function(test)
  {
    test.expect(2);

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      test.equal(result, null);
    });

    // Compose response manually from the request
    var response = JSON.parse(request);

    delete response.method;
    response.result = null;

    response = JSON.stringify(response);

    // Test response
    response = this.rpcBuilder.decode(response);

    test.equal(response, undefined);

    test.done();
  },

  'duplicate response': function(test)
  {
    test.expect(3);

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      test.equal(result, null);
    });

    // Compose response manually from the request
    var response = JSON.parse(request);

    delete response.method;
    response.result = null;

    response = JSON.stringify(response);

    // Test response
    var result = this.rpcBuilder.decode(response);
    test.equal(result, undefined);

    // Ignored response
    var result = this.rpcBuilder.decode(response);
    test.equal(result, undefined);

    test.done();
  },

  'request reply response': function(test)
  {
    test.expect(3);

    var value = {'asdf': 'qwert'};

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      test.deepEqual(result, value);
    });

    // Response request
    request = this.rpcBuilder.decode(request);

    var response = request.reply(null, value);

    // Test response message
    test.deepEqual(JSON.parse(response),
    {
      jsonrpc: '2.0',
      result: value,
      id: 0
    });

    response = this.rpcBuilder.decode(response);

    // Test response as processed
    test.equal(response, undefined);

    test.done();
  },

  'reply with transport': function(test)
  {
    test.expect(4);

    var self = this;

    var value = {'asdf': 'qwert'};

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      test.deepEqual(result, value);
    });

    // Response request
    request = this.rpcBuilder.decode(request);

    var response = request.reply(null, value, function(message)
    {
      // Test response message
      test.deepEqual(JSON.parse(message),
      {
        jsonrpc: '2.0',
        result: value,
        id: 0
      });

      message = self.rpcBuilder.decode(message);

      // Test response as processed
      test.equal(message, undefined);
    });

    // Test response as send by reply transport
    test.equal(response, undefined);

    test.done();
  },

  'decode with transport': function(test)
  {
    test.expect(4);

    var self = this;

    var value = {'asdf': 'qwert'};

    var request = this.rpcBuilder.encode(METHOD, function(error, result)
    {
      test.deepEqual(result, value);
    });

    // Response request
    request = this.rpcBuilder.decode(request, function(message)
    {
      // Test response message
      test.deepEqual(JSON.parse(message),
      {
        jsonrpc: '2.0',
        result: value,
        id: 0
      });

      message = self.rpcBuilder.decode(message);

      // Test response as processed
      test.equal(message, undefined);
    });

    var response = request.reply(null, value);

    // Test response as send by reply transport
    test.equal(response, undefined);

    test.done();
  },


  'transport with message event': function(test)
  {
    test.expect(2);

    var self = this;

    var value = {'asdf': 'qwert'};

    var transport = new EventTarget;
        transport.onmessage = null;
        transport.send = function(message)
        {
          message = JSON.parse(message);

          var event =
          {
            type: 'message',
            data: JSON.stringify(
            {
              jsonrpc: '2.0',
              result: message.params,
              id: 0
            })
          };

          this.dispatchEvent(event);
        };

    this.rpcBuilder.transport = transport;

    var request = this.rpcBuilder.encode(METHOD, value, function(error, result)
    {
      test.ifError(error);

      test.deepEqual(result, value);

      test.done();
    });

    // Test response as send by reply transport
    test.equal(request, undefined);
  }
};
