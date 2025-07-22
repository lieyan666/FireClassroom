const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const cors = require('cors');
const session = require('express-session');
const useragent = require('useragent');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'a_secret_key_for_session', // 在生产环境中应使用更安全的密钥
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // 如果使用HTTPS，应设为true
}));

// 日志中间件
app.use((req, res, next) => {
    res.on('finish', () => {
        const agent = useragent.parse(req.headers['user-agent']);
        const os = agent.os.toString();
        const browser = agent.toAgent();
        
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const timestamp = beijingTime.toISOString().replace('T', ' ').substring(0, 19);

        const log = `[${timestamp}] ${req.ip} - ${req.method} ${req.originalUrl} ${res.statusCode} - ${os}, ${browser}`;
        console.log(log);
    });
    next();
});

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.csv');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化配置文件
function initializeConfig() {
    const defaultConfig = {
        schoolName: "火焰教室",
        currentSemester: "2024春季学期",
        timeSlots: [
            { id: 1, name: "第一节", startTime: "08:00", endTime: "08:45" },
            { id: 2, name: "第二节", startTime: "08:55", endTime: "09:40" },
            { id: 3, name: "第三节", startTime: "10:00", endTime: "10:45" },
            { id: 4, name: "第四节", startTime: "10:55", endTime: "11:40" },
            { id: 5, name: "第五节", startTime: "14:00", endTime: "14:45" },
            { id: 6, name: "第六节", startTime: "14:55", endTime: "15:40" },
            { id: 7, name: "第七节", startTime: "16:00", endTime: "16:45" },
            { id: 8, name: "第八节", startTime: "16:55", endTime: "17:40" }
        ],
        weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    };
    
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    }
}

// 初始化课程文件
function initializeCourses() {
    const defaultCourses = {
        courses: [
            {
                id: "MATH001",
                name: "高等数学",
                teacher: "张教授",
                classroom: "A101",
                description: "高等数学基础课程"
            },
            {
                id: "ENG001",
                name: "大学英语",
                teacher: "李老师",
                classroom: "B201",
                description: "大学英语听说读写"
            }
        ]
    };
    
    if (!fs.existsSync(COURSES_FILE)) {
        fs.writeFileSync(COURSES_FILE, JSON.stringify(defaultCourses, null, 2));
    }
}

// 初始化课表文件
function initializeSchedule() {
    const defaultSchedule = [
        "day,timeSlot,courseId,week",
        "1,1,MATH001,1-16",
        "1,2,MATH001,1-16",
        "3,3,ENG001,1-16",
        "3,4,ENG001,1-16",
        "5,1,MATH001,1-16",
        "5,5,ENG001,1-16"
    ];
    
    if (!fs.existsSync(SCHEDULE_FILE)) {
        fs.writeFileSync(SCHEDULE_FILE, defaultSchedule.join('\n'));
    }
}

// 读取配置
function getConfig() {
    try {
        const config = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(config);
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return null;
    }
}

// 读取课程信息
function getCourses() {
    try {
        const courses = fs.readFileSync(COURSES_FILE, 'utf8');
        return JSON.parse(courses);
    } catch (error) {
        console.error('读取课程文件失败:', error);
        return { courses: [] };
    }
}

// 读取课表
function getSchedule() {
    return new Promise((resolve, reject) => {
        const schedule = [];
        if (!fs.existsSync(SCHEDULE_FILE)) {
            resolve([]);
            return;
        }
        
        fs.createReadStream(SCHEDULE_FILE)
            .pipe(csv())
            .on('data', (row) => {
                schedule.push(row);
            })
            .on('end', () => {
                resolve(schedule);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// 获取当前课程状态
function getCurrentCourseStatus() {
    return new Promise(async (resolve, reject) => {
        try {
            const config = getConfig();
            const courses = getCourses();
            const schedule = await getSchedule();
            
            const now = new Date();
            const currentDay = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
            const currentTime = now.getHours() * 60 + now.getMinutes(); // 当前时间（分钟）
            
            // 转换周几（0=周日转为7，其他保持不变）
            const dayOfWeek = currentDay === 0 ? 7 : currentDay;
            
            let currentCourse = null;
            let nextCourse = null;
            let status = 'free'; // free, inClass, break
            
            // 查找当前时间段的课程
            for (const timeSlot of config.timeSlots) {
                const [startHour, startMin] = timeSlot.startTime.split(':').map(Number);
                const [endHour, endMin] = timeSlot.endTime.split(':').map(Number);
                const startTime = startHour * 60 + startMin;
                const endTime = endHour * 60 + endMin;
                
                if (currentTime >= startTime && currentTime < endTime) {
                    // 在课程时间内
                    const courseSchedule = schedule.find(s =>
                        parseInt(s.day) === dayOfWeek &&
                        parseInt(s.timeSlot) === timeSlot.id
                    );
                    
                    if (courseSchedule) {
                        const course = courses.courses.find(c => c.id === courseSchedule.courseId);
                        if (course) {
                            currentCourse = {
                                ...course,
                                timeSlot: timeSlot,
                                startTime: timeSlot.startTime,
                                endTime: timeSlot.endTime
                            };
                            status = 'inClass';
                        }
                    }
                    break;
                }
            }
            
            // 查找下一节课
            let searchAfterTimeInMinutes;
            if (currentCourse) {
                // 如果有当前课程，从当前课程结束后开始找
                const [endHour, endMin] = currentCourse.endTime.split(':').map(Number);
                searchAfterTimeInMinutes = endHour * 60 + endMin;
            } else {
                // 如果没有当前课程，从现在开始找
                searchAfterTimeInMinutes = currentTime;
            }

            const sortedTimeSlots = config.timeSlots.slice().sort((a, b) => {
                const aStart = a.startTime.split(':').map(Number);
                const bStart = b.startTime.split(':').map(Number);
                return (aStart * 60 + aStart) - (bStart * 60 + bStart);
            });

            // 查找今天剩下的课程
            for (const timeSlot of sortedTimeSlots) {
                const [startHour, startMin] = timeSlot.startTime.split(':').map(Number);
                const startTime = startHour * 60 + startMin;

                if (startTime >= searchAfterTimeInMinutes) {
                    const courseSchedule = schedule.find(s =>
                        parseInt(s.day) === dayOfWeek &&
                        parseInt(s.timeSlot) === timeSlot.id
                    );
                    if (courseSchedule) {
                        const course = courses.courses.find(c => c.id === courseSchedule.courseId);
                        if (course) {
                            nextCourse = {
                                ...course,
                                timeSlot: timeSlot,
                                startTime: timeSlot.startTime,
                                endTime: timeSlot.endTime,
                                day: config.weekdays[dayOfWeek - 1]
                            };
                            break;
                        }
                    }
                }
            }

            // 如果今天没有了，则从明天开始查找，最多查找6天
            if (!nextCourse) {
                for (let i = 1; i < 7; i++) {
                    const nextDay = (dayOfWeek + i - 1) % 7 + 1;
                    for (const timeSlot of sortedTimeSlots) {
                        const courseSchedule = schedule.find(s =>
                            parseInt(s.day) === nextDay &&
                            parseInt(s.timeSlot) === timeSlot.id
                        );
                        if (courseSchedule) {
                            const course = courses.courses.find(c => c.id === courseSchedule.courseId);
                            if (course) {
                                nextCourse = {
                                    ...course,
                                    timeSlot: timeSlot,
                                    startTime: timeSlot.startTime,
                                    endTime: timeSlot.endTime,
                                    day: config.weekdays[nextDay - 1]
                                };
                                break;
                            }
                        }
                    }
                    if (nextCourse) {
                        break;
                    }
                }
            }
            
            resolve({
                status,
                currentCourse,
                nextCourse,
                currentTime: now.toLocaleTimeString('zh-CN', { hour12: false }),
                currentDate: now.toLocaleDateString('zh-CN')
            });
        } catch (error) {
            reject(error);
        }
    });
}

// 登录接口
app.post('/api/login', (req, res) => {
    const config = getConfig();
    const { username, password } = req.body;
    if (config && config.adminUser && username === config.adminUser.username && password === config.adminUser.password) {
        req.session.user = { username: config.adminUser.username };
        res.json({ success: true, message: '登录成功' });
    } else {
        res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
});

// 检查是否登录的中间件
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: '未授权，请先登录' });
    }
};

// API 路由

// 获取配置信息
app.get('/api/config', isAuthenticated, (req, res) => {
    const config = getConfig();
    if (config) {
        res.json(config);
    } else {
        res.status(500).json({ error: '无法读取配置文件' });
    }
});

// 获取课程列表
app.get('/api/courses', isAuthenticated, (req, res) => {
    const courses = getCourses();
    res.json(courses);
});

// 获取课表
app.get('/api/schedule', isAuthenticated, async (req, res) => {
    try {
        const schedule = await getSchedule();
        res.json({ schedule });
    } catch (error) {
        res.status(500).json({ error: '无法读取课表文件' });
    }
});

// 获取当前课程状态
app.get('/api/current-status', async (req, res) => {
    try {
        const status = await getCurrentCourseStatus();
        res.json(status);
    } catch (error) {
        console.error('获取当前状态失败:', error);
        res.status(500).json({ error: '无法获取当前课程状态' });
    }
});

// 更新配置
app.post('/api/config', isAuthenticated, (req, res) => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true, message: '配置更新成功' });
    } catch (error) {
        res.status(500).json({ error: '配置更新失败' });
    }
});

// 更新课程
app.post('/api/courses', isAuthenticated, (req, res) => {
    try {
        fs.writeFileSync(COURSES_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true, message: '课程更新成功' });
    } catch (error) {
        res.status(500).json({ error: '课程更新失败' });
    }
});

// 更新课表
app.post('/api/schedule', isAuthenticated, (req, res) => {
    try {
        const { schedule } = req.body;
        
        // 将课表数据转换为CSV格式
        const csvHeader = 'day,timeSlot,courseId,week';
        const csvRows = schedule.map(item => 
            `${item.day},${item.timeSlot},${item.courseId},${item.week}`
        );
        const csvContent = [csvHeader, ...csvRows].join('\n');
        
        fs.writeFileSync(SCHEDULE_FILE, csvContent);
        res.json({ success: true, message: '课表更新成功' });
    } catch (error) {
        console.error('课表更新失败:', error);
        res.status(500).json({ error: '课表更新失败' });
    }
});

// 初始化数据文件
initializeConfig();
initializeCourses();
initializeSchedule();

// 启动服务器
app.listen(PORT, () => {
    console.log(`🔥 火焰教室服务器运行在 http://localhost:${PORT}`);
    console.log(`📚 访问教室: http://localhost:${PORT}`);
    console.log(`⚙️  API文档: http://localhost:${PORT}/api/current-status`);
});

module.exports = app;