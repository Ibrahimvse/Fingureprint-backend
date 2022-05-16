const express=require('express')
require('dotenv').config()
const db=require('./src/db/sqlite')
const bodyparser=require('body-parser')
const fileUpload=require('express-fileupload')
const cors = require('cors')
const http=require('http')
const app=express();
const server = http.createServer(app)
const port=3000;
app.use(cors())

//Use json to parser requests
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(express.json({limit: '50mb', extended: true}));
app.use(fileUpload({
    limits: { fileSize: 1000 * 1024 * 1024 },
}));
const StaticDirectory=__dirname+"/dist/";

app.use(express.static(StaticDirectory));

const adminRouter = require('./src/routes/admin')
const fingurprintRouter = require('./src/routes/fingureprint')
app.use('/admin/', adminRouter)
app.use('/fingureprint/', fingurprintRouter)
app.get('/', (req,res) => {
    res.sendFile(StaticDirectory+"index.html")
});
app.listen(port, () => {
    console.log(`Server listening on the port::${port}`);
});