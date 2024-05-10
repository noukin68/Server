const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const http = require('http')
const socketIo = require('socket.io')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const bodyParser = require('body-parser')
const fs = require('fs')
const nodemailer = require('nodemailer')

http
	.createServer(function (req, res) {
		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end('Hello World\n')
	})
	.listen(8080, '62.217.182.138')
console.log('Server running at http://62.217.182.138:8080')
