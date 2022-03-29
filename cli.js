#!/usr/bin/env node

"use strict";
const argv = require("minimist")(process.argv.slice(2));
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const expressions = require("angular-expressions");
const assign = require("lodash/assign");
const last = require("lodash/last");
const {addFilters} = require("./counter");


addFilters(expressions)

function transformError(error) {
    const e = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        properties: error.properties,
    };
    if (e.properties && e.properties.rootError) {
        e.properties.rootError = transformError(error.properties.rootError);
    }
    if (e.properties && e.properties.errors) {
        e.properties.errors = e.properties.errors.map(transformError);
    }
    return e;
}

function printErrorAndRethrow(error) {
    const e = transformError(error);
    // The error thrown here contains additional information when logged with JSON.stringify (it contains a property object).
    console.error(JSON.stringify({ error: e }, null, 2));
    throw error;
}

function showHelp() {
    console.log("Usage: docxtemplater input.docx data.json output.docx");
    process.exit(1);
}




function parser(tag) {
    tag = tag
        .replace(/^\.$/, "this")
        .replace(/(’|‘)/g, "'")
        .replace(/(“|”)/g, '"');
    const expr = expressions.compile(tag);
    // isAngularAssignment will be true if your tag contains a `=`, for example
    // when you write the following in your template:
    // {full_name = first_name + last_name}
    // In that case, it makes sense to return an empty string so
    // that the tag does not write something to the generated document.
    const isAngularAssignment =
        expr.ast.body[0] &&
        expr.ast.body[0].expression.type ===
        "AssignmentExpression";

    return {
        get(scope, context) {
            let obj = {};
            const index = last(context.scopePathItem);
            const scopeList = context.scopeList;
            const num = context.num;
            for (let i = 0, len = num + 1; i < len; i++) {
                obj = assign(obj, scopeList[i]);
            }
            obj = assign(obj, { $index: index });

            const result = expr(scope, obj);
            if (isAngularAssignment) {
                return "";
            }
            return result;
        },
    };
}

const args = argv._;
if (argv.help || args.length !== 3) {
    showHelp();
}
let options = {};
if (argv.options) {
    try {
        options = JSON.parse(argv.options);
    } catch (e) {
        console.error("Arguments passed in --options is not valid JSON");
        throw e;
    }
}

const [inputFile, dataFile, outputFile] = args;
const input = fs.readFileSync(inputFile, "binary");
const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
options.parser = parser;

let doc;

try {
    doc = new Docxtemplater(new PizZip(input), options);
} catch (e) {
    printErrorAndRethrow(e);
}

doc.setData(data);

try {
    doc.render();
} catch (error) {
    printErrorAndRethrow(error);
}

const generated = doc
    .getZip()
    .generate({ type: "nodebuffer", compression: "DEFLATE" });

fs.writeFileSync(outputFile, generated);
