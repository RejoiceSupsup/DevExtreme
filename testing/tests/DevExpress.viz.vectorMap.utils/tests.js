"use strict";

/* global ROOT_URL */

require("../../../artifacts/js/vectormap-utils/dx.vectormaputils.js");

var $ = require("jquery"),
    utils = DevExpress.viz["vectormaputils"];

var CONTROLLER_URL = ROOT_URL + "TestVectorMapData/",
    TEST_DATA_URL = ROOT_URL + "testing/content/VectorMapData/";

var testData = JSON.parse(require("../../../TestVectorMapData/GetTestData!text"));

testData.forEach(function(testDataItem) {
    testDataItem.expected = JSON.parse(testDataItem.expected);
    applyDatesPatch(testDataItem.expected, function(value) {
        var parts = value.split("-");
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    });
});

if(typeof ArrayBuffer !== "undefined") {

    QUnit.module("browser - parse ArrayBuffer");

    testData.forEach(function(testDataItem) {
        QUnit.test(testDataItem.name, function(assert) {
            var done = assert.async();
            $.when(loadBinaryData(TEST_DATA_URL + testDataItem.name + ".shp"), loadBinaryData(TEST_DATA_URL + testDataItem.name + ".dbf")).then(function(shapeData, dataBaseFileData) {
                var func,
                    data,
                    errors;
                func = utils.parse({ "shp": shapeData, "dbf": dataBaseFileData }, function(data_, errors_) {
                    data = data_;
                    errors = errors_;
                });
                assert.strictEqual(func, data, "function result");
                assert.deepEqual(data, testDataItem.expected, "parsing result");
                checkErrors(assert, errors, testDataItem.name);
                done();
            });
        });
    });

    QUnit.module("browser - load and parse");

    testData.forEach(function(testDataItem) {
        QUnit.test(testDataItem.name, function(assert) {
            var done = assert.async(),
                func;
            func = utils.parse(TEST_DATA_URL + testDataItem.name, function(data, errors) {
                assert.strictEqual(func, undefined, "function result");
                assert.deepEqual(data, testDataItem.expected, "parsing result");
                checkErrors(assert, errors, testDataItem.name);
                done();
            });
        });
    });

}

QUnit.module("node - parse Buffer");

testData.forEach(function(testDataItem) {
    QUnit.test(testDataItem.name, function(assert) {
        var done = assert.async();
        $.getJSON(CONTROLLER_URL + "ParseBuffer/" + testDataItem.name).done(function(response) {
            applyNodeDatesPatch(response.data);
            assert.strictEqual(response.func, true, "function result");
            assert.deepEqual(response.data, testDataItem.expected, "parsing result");
            checkErrors(assert, response.errors, testDataItem.name);
            done();
        });
    });
});

QUnit.module("node - read and parse");

testData.forEach(function(testDataItem) {
    QUnit.test(testDataItem.name, function(assert) {
        var done = assert.async();
        $.getJSON(CONTROLLER_URL + "ReadAndParse/" + testDataItem.name).done(function(response) {
            applyNodeDatesPatch(response.data);
            assert.strictEqual(response.func, true, "function result");
            assert.deepEqual(response.data, testDataItem.expected, "parsing result");
            checkErrors(assert, response.errors, testDataItem.name);
            done();
        });
    });
});

QUnit.module("node-console");

function isPoint(obj) {
    return obj.name === "Point";
}

QUnit.test("process single file", function(assert) {
    var done = assert.async();
    $.getJSON(CONTROLLER_URL + "ExecuteConsoleApp", { file: "Point.shp" }, function(response) {
        assert.strictEqual(response.length, 1, "count");
        applyNodeDatesPatch(response[0].content);
        assert.strictEqual(response[0].file, "test_Point.js", "file");
        assert.strictEqual(response[0].variable, "test.namespace.Point", "variable");
        assert.deepEqual(response[0].content, $.grep(testData, isPoint)[0].expected, "content");
        done();
    });
});

QUnit.test("process directory", function(assert) {
    var done = assert.async();
    $.getJSON(CONTROLLER_URL + "ExecuteConsoleApp", function(response) {
        assert.strictEqual(response.length, testData.length, "count");
        response.forEach(function(responseItem) {
            var testDataItem = $.grep(testData, function(obj) { return obj.name === responseItem.file.substr(5).replace(".js", ""); })[0];
            assert.strictEqual(responseItem.variable, "test.namespace." + testDataItem.name, "variable /" + testDataItem.name);
            applyNodeDatesPatch(responseItem.content);
            assert.deepEqual(responseItem.content, testDataItem.expected, "content / " + testDataItem.name);
        });
        done();
    });
});

QUnit.test("process single file / json", function(assert) {
    var done = assert.async();
    $.getJSON(CONTROLLER_URL + "ExecuteConsoleApp", { file: "Point.shp", json: true }, function(response) {
        assert.strictEqual(response.length, 1, "count");
        applyNodeDatesPatch(response[0].content);
        assert.strictEqual(response[0].file, "test_Point.json", "file");
        assert.deepEqual(response[0].content, $.grep(testData, isPoint)[0].expected, "content");
        done();
    });
});

QUnit.test("process directory / json", function(assert) {
    var done = assert.async();
    $.getJSON(CONTROLLER_URL + "ExecuteConsoleApp", { json: 1 }, function(response) {
        assert.strictEqual(response.length, testData.length, "count");
        response.forEach(function(responseItem) {
            var testDataItem = $.grep(testData, function(obj) { return obj.name === responseItem.file.substr(5).replace(".json", ""); })[0];
            applyNodeDatesPatch(responseItem.content);
            assert.deepEqual(responseItem.content, testDataItem.expected, "content / " + testDataItem.name);
        });
        done();
    });
});

function applyDatesPatch(obj, parser) {
    obj.features.forEach(function(feature) {
        feature.properties.Date = parser(feature.properties.Date);
    });
}

function applyNodeDatesPatch(obj) {
    applyDatesPatch(obj, function(value) {
        var offset = (new Date(value)).getTimezoneOffset();
        var vals = value.split("T")[0].split("-");
        return new Date(Number(vals[0]), Number(vals[1]) - 1, Number(vals[2]) + (offset < 0 ? 1 : 0));
    });
}

function loadBinaryData(url) {
    var $deferred = $.Deferred(),
        request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "arraybuffer";
    request.addEventListener("load", function() {
        if(this.readyState === 4) {
            $deferred.resolve(this.status === 200 ? this.response : null);
        }
    });
    request.send(null);
    return $deferred.promise();
}
function checkErrors(assert, errors, name) {
    if(name === "Polygon(Polygon_with_null)") {
        assert.equal(errors.length, 1, "should be one error");
        assert.equal(errors[0], "shp: shape #2 type: Null / expected: Polygon", "parsing errors");
    } else {
        assert.strictEqual(errors, null, "parsing errors");
    }
}
