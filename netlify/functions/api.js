"use strict";

const { handleNetlifyEvent } = require("../../api-handler");

exports.handler = async (event) => handleNetlifyEvent(event);
