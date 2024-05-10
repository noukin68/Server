const tls = require('tls')
const fs = require('fs')
const path = require('path')

// Загрузка сертификата сервера
const serverCert = fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))

// Загрузка ключа сервера
const serverKey = fs.readFileSync(path.join(__dirname, 'cert', 'key.pem'))

// Загрузка корневого сертификата
const rootCert = fs.readFileSync(path.join(__dirname, 'cert', 'cloudflare.crt'))

// Создание опций для проверки цепочки сертификатов
const options = {
	cert: serverCert,
	key: serverKey,
	ca: [rootCert],
	rejectUnauthorized: true,
}

// Создание TLS-соединения и проверка цепочки сертификатов
const tlsSocket = tls.connect(443, '62.217.182.138', options, () => {
	console.log('TLS connection established')

	// Получение информации о цепочке сертификатов
	const peerCertificate = tlsSocket.getPeerCertificate(true)
	console.log('Peer certificate chain:', peerCertificate)

	// Проверка корректности цепочки сертификатов
	tlsSocket.verify()
	console.log('Certificate chain verified successfully')
})

tlsSocket.on('error', err => {
	console.error('TLS connection error:', err)
})
