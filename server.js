const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const https = require('https')
const socketIo = require('socket.io')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const bodyParser = require('body-parser')
const fs = require('fs')
const nodemailer = require('nodemailer')

https
	.createServer(function (req, res) {
		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end('Hello World\n')
	})
	.listen(433, '62.217.182.138')
console.log('Server running at https://62.217.182.138:433')
