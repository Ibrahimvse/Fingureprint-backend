const express = require('express')
const ZKLib = require('node-zklib');
const nconf = require('nconf');
const router = new express.Router();
const Database = require('better-sqlite3');
const path=require('path');
const databasePath=path.resolve(__dirname,'..\\..')+'\\database.db'
function msToTime(duration) {
    var milliseconds = parseInt((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)));

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds;
}
function setDepartment(user) {
    var department=user.department;
    if(user.unit!='') department=department+" / "+user.unit;
    return department;
}
function decodeName(name) {
    const encoded = "VYRfIlQDAFX_cdJGaHmSTOLMNeZ[]^KUPBECYzYrYvYqYuYpYsYx";
    const decoded = "ضظزوةىرؤءئطكمنتالبيسشدجحخهعغفقثصذآإأظْظٍظِظٌظُظًظَظّ";
    return name.split('').map(character => {
        const index = encoded.indexOf(character);
        if (index > -1) {
            return decoded[index];
        }
        return character;
    }).join('');
}
var createZkInstance = async function (ip) {
    var zkInstance = await new ZKLib(ip, 4370,10000);
    await zkInstance.createSocket();
    return zkInstance
}
var getDeviceUsers = async function (ip) {
    var users = [];
    try {
        var zkInstance = await createZkInstance(ip);
        await zkInstance.getUsers().then(async ({ data }) => {
            users = data.map((user) => {
                return {
                    id: parseInt(user.userId),
                    name: decodeName(user.name),
                    cardno: user.cardno,
                    password: user.password,
                    role: user.role,
                    department: '',
                    unit: '',
                    notes: '',
                    allowance: 0

                }
            });
            await zkInstance.disconnect();
        });
        return users;
    } catch (e) {
        console.log(e)
        return users;
    }
}
var getDeviceLogs = async function (ip) {
    var logs = [];
    try {
        var zkInstance = await createZkInstance(ip);
        await zkInstance.getAttendances().then(async ({ data }) => {
            logs = data;
            await zkInstance.disconnect();
        });
        return logs;
    } catch (e) {
        console.log(e)
        return logs;
    }
}
var calculateMonthlyAbsense = async (users, validRecords) => {
    var results = [];
    var TimePeriod=await findInOutTime();
    var cuurentDate = new Date();
    var inTime = cuurentDate.setTime(TimePeriod.inTime);
    var midTime = cuurentDate.setTime(11 * 3600 * 1000);
    var outTime = cuurentDate.setTime(TimePeriod.outTime);
    for (var user of users) {
        var userRecords = validRecords.filter(item => item.id == user.id);
        var total = 0;
        userRecords.sort(function compare(a, b) {
            return a.record.recordTime - b.record.recordTime;
        })
        var set = new Set(userRecords.map(u => u.record.date))
        for (var item of set) {
            var dayRecords = userRecords.filter(record => record.record.date == item);
            var userIn = dayRecords[0].record.recordTime;
            var userOut = dayRecords[dayRecords.length - 1].record.recordTime;
            var day=new Date(item).getDay();
            if(day==4) outTime = cuurentDate.setTime(TimePeriod.outTime-60000);
            else outTime = cuurentDate.setTime(TimePeriod.outTime);
            userIn = (userIn.getHours() * 3600 + userIn.getMinutes() * 60) * 1000;
            userOut = (userOut.getHours() * 3600 + userOut.getMinutes() * 60) * 1000;
            if ((userOut - userIn) <= 600000) {
                if (userIn < midTime) {
                    if (userIn > inTime) total = total + (userIn - inTime);
                }
                else {
                    if (userOut < outTime) total = total + (outTime - userOut);
                }
            } else {
                if (userIn > inTime) total = total + (userIn - inTime);
                else if (userOut < outTime) total = total + (outTime - userOut);
            }
        }
        var size = set.size;

        results.push({
            name: user.name,
            id: user.id,
            department: setDepartment(user),
            dayscount: size,
            totalTime: msToTime(total),
            notes:user.notes
        })

    }
    return results;
}

var findInOutTime=async()=>{
    const fingureprintoffice = await nconf.file({ file: 'config.json' }).get('office')
    var jsonTimePeriod=fingureprintoffice.TimePeriod;
    var intime=jsonTimePeriod.inTime.split(':');
    var outtime=jsonTimePeriod.outTime.split(':');
    var inTime=(+intime[0]*3600000)+(+intime[1]*60*1000)
    var outTime=(+outtime[0]*3600000)+(+outtime[1]*60*1000)
    var TimePeriod={
        inTime:inTime,
        outTime:outTime
    }
    return TimePeriod;
}

var calculateDailyAbsense = async (users, validRecords, day,report_type) => {
    var results = [];
    var TimePeriod=await findInOutTime();
    var cuurentDate = new Date();
    var inTime = cuurentDate.setTime(TimePeriod.inTime);
    var midTime = cuurentDate.setTime(11 * 3600 * 1000);
    var outTime = cuurentDate.setTime(TimePeriod.outTime);
    if (day == 4) outTime = cuurentDate.setTime(outTime-60000);
    for (var user of users) {
        var userRecords = validRecords.filter(item => item.id == user.id);
        var total = 0;
        var input = '-- غائب --';
        var output = '-- غائب --';
        if (userRecords.length > 0) {
            userRecords.sort(function compare(a, b) {
                return a.record.recordTime - b.record.recordTime;
            })
            var userIn = userRecords[0].record.recordTime;
            var userOut = userRecords[userRecords.length - 1].record.recordTime;
            userIn = (userIn.getHours() * 3600 + userIn.getMinutes() * 60) * 1000;
            userOut = (userOut.getHours() * 3600 + userOut.getMinutes() * 60) * 1000;
            if ((userOut - userIn) <= 600000) {
                if (userIn < midTime) {
                    input = msToTime(userIn);
                    if (userIn > inTime && report_type!='out') total = total + (userIn - inTime);
                }
                else {
                    output = msToTime(userOut);
                    if (userOut < outTime && report_type!='in') total = total + (outTime - userOut);
                }
            } else {
                input = msToTime(userIn);
                output = msToTime(userOut);
                if (userIn > inTime && report_type!='out') total = total + (userIn - inTime);
                else if (userOut < outTime && report_type!='in') total = total + (outTime - userOut);
            }
        }
        results.push({
            id: user.id,
            name: user.name,
            input: input,
            output: output,
            department: setDepartment(user),
            notes: '',
            totalTime: msToTime(total)
        })
    }
    return results;
}
var calculateEmployeeReport = async (user, userRecords) => {
    var results=[];
    var TimePeriod=await findInOutTime();
    var cuurentDate = new Date();
    var inTime = cuurentDate.setTime(TimePeriod.inTime);
    var midTime = cuurentDate.setTime(11 * 3600 * 1000);
    var outTime = cuurentDate.setTime(TimePeriod.outTime);
    if(userRecords.length){
        userRecords.sort(function compare(a, b) {
            return a.record.recordTime - b.record.recordTime;
        })
        var set = new Set(userRecords.map(u => u.record.date));
        for (var item of set) {
            var dayRecords = userRecords.filter(record => record.record.date == item);
            var userIn = dayRecords[0].record.recordTime;
            var userOut = dayRecords[dayRecords.length - 1].record.recordTime;
            userIn = (userIn.getHours() * 3600 + userIn.getMinutes() * 60) * 1000;
            userOut = (userOut.getHours() * 3600 + userOut.getMinutes() * 60) * 1000;
            var total = 0;
            var input = '-- غائب --';
            var output = '-- غائب --';
            var day=new Date(item).getDay();
            if(day==4) outTime = cuurentDate.setTime(TimePeriod.outTime-60000);
            else outTime = cuurentDate.setTime(TimePeriod.outTime);
            if ((userOut - userIn) <= 600000) {
                if (userIn < midTime) {
                    input = msToTime(userIn);
                    if (userIn > inTime) total = total + (userIn - inTime);
                }
                else {
                    output = msToTime(userOut);
                    if (userOut < outTime ) total = total + (outTime - userOut);
                }
            } else {
                input = msToTime(userIn);
                output = msToTime(userOut);
                if (userIn > inTime ) total = total + (userIn - inTime);
                else if (userOut < outTime) total = total + (outTime - userOut);
            }

            results.push({
                name: user.name,
                date:item,
                input: input,
                output: output,
                totalTime: msToTime(total)
            })
        }
    }
    return results;
};
router.post('/connectdevice', async (req, res) => {
    let zkInstance = new ZKLib(req.body.ip, 4370, 5000);
    var device = req.body;
    try {
        await zkInstance.createSocket();
        device.status = "yes";
        res.status(200).json(device)
    } catch (e) {
        device.status = "fail";
        res.status(200).json(device);
    }
});
router.post('/device/users', async (req, res) => {
    var users = [];
    try {
        users = await getDeviceUsers(req.body.ip);
        res.status(200).json(users)
    } catch (e) {
        console.log(error);
        res.status(200).json(users);
    }
})
router.post('/device/logs', async (req, res) => {
    var logs = [];
    try {
        logs = await getDeviceLogs(req.body.ip);
        res.status(200).json(logs)
    } catch (e) {
        console.log(error);
        res.status(200).json(logs);
    }
})

router.post('/device/downloadUsers', async (req, res) => {
    var users = [];
    try {
        for (var d of req.body.devices) {
            var deviceUsers = await getDeviceUsers(d.ip);
            var filterdUsers = deviceUsers.filter((user) =>(users.findIndex((u)=>u.id===user.id) < 0)==true)
            users = users.concat(filterdUsers);
        }
        var databaseUsers=await getEmployees();
        var newtUsers = users.filter((user) =>(databaseUsers.findIndex((u)=>u.id===user.id) < 0)==true)
        const db=new Database(databasePath);
        const insert = db.prepare('INSERT INTO Employee (id,name, department,unit,cardno,role,allowance,password,notes) VALUES (@id,@name, @department,@unit,@cardno,@role,@allowance,@password,@notes)');
        const insertMany = db.transaction((users) => {
            for (const user of users) insert.run(user);
        });
        insertMany(newtUsers);
       
        res.status(200).json(newtUsers)
    } catch (e) {
        console.log(e);
        res.status(200).json(users);
    }
})


router.post('/fingureprintoffice/monthlyreport', async (req, res) => {
    var logs = []; 
    var users=await getEmployees();
    try {
        for (var d of req.body.devices) {
            logs = logs.concat(await getDeviceLogs(d.ip))
        }
        var start = new Date(req.body.dates.start);
        var end = new Date(req.body.dates.end);
        var validRecords = logs.filter(item => (item.recordTime >= start && item.recordTime <= end))
        validRecords = validRecords.map((item) => {
            var recordTime = item.recordTime;
            var date = recordTime.getFullYear() + "-" + (recordTime.getMonth() + 1) + "-" + recordTime.getDate();
            var time = recordTime.getHours() + ":" + recordTime.getMinutes() + ":" + recordTime.getSeconds();
            return {
                id: parseInt(item.deviceUserId),
                record: {
                    recordTime: recordTime,
                    date: date,
                    time: time
                }
            }
        })
        var results = await calculateMonthlyAbsense(users, validRecords)
        res.status(200).json(results)
    } catch (e) {
        console.log(e);
        res.status(200).json(logs);
    }
})

router.post('/fingureprintoffice/dailyreport', async (req, res) => {
    var logs = []; 
    var users=await getEmployees();
    try {

        for (var d of req.body.devices) {
            logs = logs.concat(await getDeviceLogs(d.ip))
        }
        var start = new Date(req.body.dates.start);
        var end = new Date(req.body.dates.start);
        end.setDate(end.getDate() + 1);
        var validRecords = await logs.filter(item => (item.recordTime >= start && item.recordTime <= end))
        validRecords = validRecords.map((item) => {
            var recordTime = item.recordTime;
            var date = recordTime.getFullYear() + "-" + (recordTime.getMonth() + 1) + "-" + recordTime.getDate();
            var time = recordTime.getHours() + ":" + recordTime.getMinutes() + ":" + recordTime.getSeconds();
            return {
                id: parseInt(item.deviceUserId),
                record: {
                    recordTime: recordTime,
                    date: date,
                    time: time
                }
            }
        })
        var results = await calculateDailyAbsense(users, validRecords, start.getDay(),req.body.report_type)
        res.status(200).json(results)
    } catch (e) {
        console.log(e);
        res.status(200).json(logs);
    }
})

router.post('/fingureprintoffice/employeeReport', async (req, res) => {
    var logs = []; 
    var user=await getEmployeeById(req.body.id);
    try {

        for (var d of req.body.devices) {
            logs = logs.concat(await getDeviceLogs(d.ip))
        }
        var start = new Date(req.body.dates.start);
        var end = new Date(req.body.dates.end);
        var validRecords = logs.filter(item => item.deviceUserId==user.id)
        var validRecords = validRecords.filter(item => (item.recordTime >= start && item.recordTime <= end))
        validRecords = validRecords.map((item) => {
            var recordTime = item.recordTime;
            var date = recordTime.getFullYear() + "-" + (recordTime.getMonth() + 1) + "-" + recordTime.getDate();
            var time = recordTime.getHours() + ":" + recordTime.getMinutes() + ":" + recordTime.getSeconds();
            return {
                id: parseInt(item.deviceUserId),
                record: {
                    recordTime: recordTime,
                    date: date,
                    time: time
                }
            }
        })
        var results = await calculateEmployeeReport(user, validRecords)
        res.status(200).json(results)
    } catch (e) {
        console.log(e);
        res.status(200).json(logs);
    }
})

router.post('/fingureprintoffice/timeoffReport', async (req, res) => {
    var results=[];
    try{
        var startdate=req.body.startdate;
        var enddate=req.body.enddate;
        var users=await getEmployees();
        var statement=`SELECT * From TimeOff where  Date(TimeOffDate) >= '${startdate}' AND Date(TimeOffDate)<= '${enddate}'`;
        var EmployeesTimeOffs= await getAllTimeOffs(statement);
        for(var user of users){
            var userRecords=EmployeesTimeOffs.filter((item)=>item.EmployeeId==user.id);
            var userTotal=0;
            for(var record of userRecords){
                userTotal=userTotal+record.TimeOffTotal;
            }
            results.push({
                id:user.id,
                name:user.name,
                department:setDepartment(user),
                timeOffsNumber:userRecords.length,
                totalTime:msToTime(userTotal)
            })
        }
        res.status(200).json(results);

    }catch(e){
        console.log(e);
        res.status(400).send({ error: e.message })
    }

})
router.get('/fingureprintoffice', async (req, res) => {
    try {

        const fingureprintoffice = nconf.file({ file: 'config.json' })
        res.status(200).json(fingureprintoffice);
    } catch (e) {
        res.status(400).send({ error: e.message })
    }
});

router.get('/Employees', async (req, res) => {
    try {
        var result = await getEmployees();
        res.status(200).json(result);
    } catch (e) {
        res.status(400).send({ error: e.message })
    }
});
router.get('/Employees/:id', async (req, res) => {
    try {
        var employee = await getEmployeeById(req.params.id)
        res.status(200).json(employee);
    } catch (e) {
        console.log(e)
        res.status(400).send({ error: e.message })
    }
});
router.patch('/Employees/:id', async (req, res) => {
    try {
        var data = req.body;
        data.allowance = data.allowance ? 1 : 0;
        const db = new Database(databasePath);
        var stmt = db.prepare("UPDATE Employee SET name=?,department=?,unit=?,notes=?,allowance=? where id=?");
        stmt.run(data.name, data.department, data.unit, data.notes, data.allowance, req.params.id);
        db.close();
        res.status(200).json();
    } catch (e) {
        console.log(e)
        res.status(400).send({ error: e.message })
    }
});
router.delete('/Employees/:id', async (req, res) => {
    try {
        const db = new Database(databasePath);
        var stmt = db.prepare(`DELETE  From Employee where id=${req.params.id}`);
        stmt.run();
        var Employees=await getEmployees();
        res.status(200).json(Employees);
        db.close();
    } catch (e) {
        res.status(400).send({ error: e.message })
    }
});
var getEmployees = async function () {
    var result = [];
    try {
        const db = new Database(databasePath);
        var result = db.prepare("SELECT * From Employee").all();
        db.close();
        return result;

    } catch (e) {
        console.log(e)
        return result;
    }
}
var getEmployeeById = async function (id) {
    try {
        const db = new Database(databasePath);
        var result = db.prepare(`SELECT * From Employee where id=${id}`).get();
        db.close();
        return result;

    } catch (e) {
        console.log(e)
        return result;
    }
}

router.get('/TimeOff/:id', async (req, res) => {
    try{
        const db = new Database(databasePath);
        var statement=`SELECT * From TimeOff where EmployeeId=${req.params.id}`;
        var EmployeeTimeOffs=await getEmployeeTimeOffById(statement);
        db.close();
        res.status(200).json(EmployeeTimeOffs);

    }catch(e){
        console.log(e)
        res.status(400).send({ error: e.message })
    }

})

router.post('/TimeOff/:id', async (req, res) => {
    try{
        var startdate=req.body.startdate;
        var enddate=req.body.enddate;
        const db = new Database(databasePath);
        var statement=`SELECT * From TimeOff where EmployeeId=${req.params.id} AND Date(TimeOffDate) >= '${startdate}' AND Date(TimeOffDate)<= '${enddate}'`;
        var EmployeeTimeOffs=await getEmployeeTimeOffById(statement);
        db.close();
        res.status(200).json(EmployeeTimeOffs);

    }catch(e){
        console.log(e)
        res.status(400).send({ error: e.message })
    }

})

router.post('/TimeOff', async (req, res) => {
    try {
        const db = new Database(databasePath);
        var stmt = db.prepare(`INSERT  into TimeOff (EmployeeId,TimeOffDate,TimeOffOut,TimeOffIn,TimeOffTotal) Values(@EmployeeId,@TimeOffDate,@TimeOffOut,@TimeOffIn,@TimeOffTotal)`);
        stmt.run(req.body);
        var statement=`SELECT * From TimeOff where EmployeeId=${req.body.EmployeeId}`;
        var EmployeeTimeOffs=await getEmployeeTimeOffById(statement);
        res.status(200).json(EmployeeTimeOffs);
        db.close();
    } catch (e) {
        console.log(e)
        res.status(400).send({ error: e.message })
    }
});

router.delete('/TimeOff/:id/:EmployeeId', async (req, res) => {
    try {
        const db = new Database(databasePath);
        var stmt = db.prepare(`DELETE  From TimeOff where id=${req.params.id}`);
        stmt.run();
        var statement=`SELECT * From TimeOff where EmployeeId=${req.params.EmployeeId}`;
        var EmployeeTimeOffs=await getEmployeeTimeOffById(statement);
        db.close();
        res.status(200).json(EmployeeTimeOffs);
    } catch (e) {
        res.status(400).send({ error: e.message })
    }
});


var getEmployeeTimeOffById = async function (statement) {
    try {
        const db = new Database(databasePath);
        var sum=0;
        var results = db.prepare(statement).all();
        results= results.map((item) => {
            var TimeOffDate = item.TimeOffDate.split('T')[0];
            sum=sum+item.TimeOffTotal;
            return {
                id: parseInt(item.id),
                TimeOffDate:TimeOffDate,
                TimeOffOut:item.TimeOffOut,
                TimeOffIn:item.TimeOffIn,
                TimeOffTotal:msToTime(item.TimeOffTotal)    
            }
        })
        var result={
            results:results,
            TotalTime:msToTime(sum)
        }
        db.close();
        return result;

    } catch (e) {
        console.log(e)
        return result;
    }
}

var getAllTimeOffs =async function (statement) {
    var result = [];
    try {
        const db = new Database(databasePath);
        var result = db.prepare(statement).all();
        db.close();
        return result;

    } catch (e) {
        console.log(e)
        return result;
    }
}

module.exports = router;