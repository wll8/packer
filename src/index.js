#!/usr/bin/env node

const shelljs = require('shelljs');
const add = require('./util/add.js');
shelljs.exec(`echo ${add(`hello `, `word~`)}`)