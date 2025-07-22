const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const cors = require('cors');
const session = require('express-session');
const useragent = require('useragent');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
// app.use(express.static('public')); // 将在主路由中处理
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

// 全局配置变量
let appConfig = {};

// 自动从 .example 文件复制配置文件
function initializeDataFiles() {
    const filesToInitialize = ['config.json', 'courses.json', 'schedule.csv'];
    
    filesToInitialize.forEach(file => {
        const realPath = path.join(DATA_DIR, file);
        const examplePath = `${realPath}.example`;
        
        if (!fs.existsSync(realPath) && fs.existsSync(examplePath)) {
            console.log(`'${file}' not found. Copying from '${file}.example'...`);
            fs.copyFileSync(examplePath, realPath);
        }
    });
}

// 加载或重载配置
function loadConfig() {
    try {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        appConfig = JSON.parse(configData);
        console.log('配置文件已成功加载/重载。');
    } catch (error) {
        console.error('读取或解析配置文件失败:', error);
        // 如果加载失败，可以保留旧的配置或设置一个默认值
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
            const config = appConfig;
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
    const config = appConfig;
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
        return next();
    }

    // 区分API请求和页面请求
    if (req.accepts('html')) {
        // 对于页面请求，重定向到登录页
        return res.redirect('login');
    } else {
        // 对于API请求，发送JSON错误
        return res.status(401).json({ error: '未授权，请先登录' });
    }
};

// --- 主路由 ---
const mainRouter = express.Router();

// 静态文件服务
mainRouter.use('/public', express.static(path.join(__dirname, 'public')));

// 动态注入 <base> 标签并提供 HTML 文件
function serveHtmlWithBaseTag(req, res, filePath) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading HTML file.');
        }
        const baseTag = `<base href="${appConfig.routePrefix}/">`;
        const modifiedHtml = data.replace('<head>', `<head>\n    ${baseTag}`);
        res.send(modifiedHtml);
    });
}

// 页面路由
mainRouter.get('/', (req, res) => serveHtmlWithBaseTag(req, res, path.join(__dirname, 'public', 'index.html')));
mainRouter.get('/login', (req, res) => serveHtmlWithBaseTag(req, res, path.join(__dirname, 'public', 'login.html')));
mainRouter.get('/admin', isAuthenticated, (req, res) => serveHtmlWithBaseTag(req, res, path.join(__dirname, 'public', 'admin.html')));

// API 路由
mainRouter.get('/api/config', isAuthenticated, (req, res) => {
    if (appConfig) {
        res.json(appConfig);
    } else {
        res.status(500).json({ error: '无法读取配置文件' });
    }
});
mainRouter.get('/api/courses', isAuthenticated, (req, res) => {
    const courses = getCourses();
    res.json(courses);
});
mainRouter.get('/api/schedule', isAuthenticated, async (req, res) => {
    try {
        const schedule = await getSchedule();
        res.json({ schedule });
    } catch (error) {
        res.status(500).json({ error: '无法读取课表文件' });
    }
});
mainRouter.get('/api/current-status', async (req, res) => {
    try {
        const status = await getCurrentCourseStatus();
        res.json(status);
    } catch (error) {
        console.error('获取当前状态失败:', error);
        res.status(500).json({ error: '无法获取当前课程状态' });
    }
});
mainRouter.get('/api/version', (req, res) => {
    res.json({
        gitCommit: getGitCommitHash(),
        appVersion: require('./package.json').version,
        hostname: os.hostname()
    });
});
mainRouter.post('/api/login', (req, res) => {
    const config = appConfig;
    const { username, password } = req.body;
    if (config && config.adminUser && username === config.adminUser.username && password === config.adminUser.password) {
        req.session.user = { username: config.adminUser.username };
        res.json({ success: true, message: '登录成功' });
    } else {
        res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
});
mainRouter.post('/api/config', isAuthenticated, (req, res) => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true, message: '配置更新成功' });
    } catch (error) {
        res.status(500).json({ error: '配置更新失败' });
    }
});
mainRouter.post('/api/courses', isAuthenticated, (req, res) => {
    try {
        fs.writeFileSync(COURSES_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true, message: '课程更新成功' });
    } catch (error) {
        res.status(500).json({ error: '课程更新失败' });
    }
});
mainRouter.post('/api/schedule', isAuthenticated, (req, res) => {
    try {
        const { schedule } = req.body;
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

// 原生方式获取Git提交哈希
function getGitCommitHash() {
    try {
        const headPath = path.join(__dirname, '.git', 'HEAD');
        if (!fs.existsSync(headPath)) return 'N/A';
        
        const head = fs.readFileSync(headPath, 'utf8').trim();
        if (head.startsWith('ref: ')) {
            const refPath = path.join(__dirname, '.git', head.substring(5));
            if (!fs.existsSync(refPath)) return 'N/A';
            return fs.readFileSync(refPath, 'utf8').trim().substring(0, 7);
        } else {
            return head.substring(0, 7); // Detached HEAD
        }
    } catch (error) {
        console.error('获取Git提交哈希失败:', error);
        return 'N/A';
    }
}

// 初始化数据文件
initializeDataFiles();

// 启动服务器
app.listen(PORT, () => {
    console.log(`🔥 火焰教室服务器运行在 http://localhost:${PORT}`);
    console.log(`📚 访问教室: http://localhost:${PORT}`);
    console.log(`⚙️  API文档: http://localhost:${PORT}/api/current-status`);
    
    // 初始加载配置
    loadConfig();

    // 动态挂载主路由
    if (appConfig.routePrefix) {
        app.use(appConfig.routePrefix, mainRouter);
        // 根路径返回 403 Forbidden
        app.get('/', (req, res) => {
            res.status(403).send('Forbidden');
        });
        console.log(`🚀 应用已挂载到: ${appConfig.routePrefix}`);
    } else {
        app.use('/', mainRouter);
        console.log(`🚀 应用已挂载到根路径 /`);
    }

    // 监控配置文件变化
    fs.watch(CONFIG_FILE, (eventType, filename) => {
        if (filename && eventType === 'change') {
            console.log(`🔄 检测到配置文件 '${filename}' 发生变化，正在热重载...`);
            // 注意：热重载路由前缀需要重启服务器才能生效
            loadConfig();
        }
    });
});

module.exports = app;