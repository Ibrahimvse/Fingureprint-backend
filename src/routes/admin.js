var express = require('express');
var router = express.Router();
const nconf=require("nconf");
const path=require('path');
const fs=require('fs')
const configPath=path.resolve(__dirname,'..\\..')+'\\config.json'
const databasePath=path.resolve(__dirname,'..\\..')+'\\database.db'

//****************************************************************************** */
//******************************** College ************************************* */
//****************************************************************************** */

router.get('/configs',async(req, res) => {
    try{
        nconf.file({file:configPath})
        const office=nconf.get('office');
        res.status(200).json(office);

    } catch (e) { 
        res.status(400).send({error:e.message})
    }
});

router.post('/importDatabase',async(req, res) => {
    try{
        fs.writeFileSync(databasePath,req.files.File.data)
        res.status(200).json();
    } catch (e) { 
        res.status(400).send({error:e.message})
    }
});

router.post('/importConfigs',async(req, res) => {
    try{
        fs.writeFileSync(configPath,req.files.File.data)
        nconf.file({file:configPath})
        nconf.set('office:TimePeriod',{
            "inTime": "08:30",
            "outTime": "14:30",
            "ThuresDay": "13:30"
          })
        nconf.save();
        res.status(200).json();
    } catch (e) { 
        res.status(400).send({error:e.message})
    }
});

router.get('/exportConfigs',async(req, res) => {
    try{
        var filename="config.json";
        var file = fs.createReadStream(configPath);
        res.writeHead(200, {'Content-disposition': 'attachment; filename='+filename}); 
        file.pipe(res)
    } catch (e) { 
        res.status(400).send({error:e.message})
    }
});
router.get('/exportDatabase',async(req, res) => {
    try{
        var filename="database.db";
        var file = fs.createReadStream(databasePath);
        res.writeHead(200, {'Content-disposition': 'attachment; filename='+filename}); 
        file.pipe(res)
    } catch (e) { 
        res.status(400).send({error:e.message})
    }
});

router.patch('/configs', async (req, res) => {  
    try {
        nconf.file({file:configPath})
        nconf.set('office',req.body)
        nconf.save();
        const office=nconf.get('office');
		res.status(200).send(office);
    } catch (e) {
        res.status(400).send(e.errmsg)
    }
});



module.exports = router