require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');
const { password } = require('pg/lib/defaults');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' }); // Directory to temporarily store uploaded files



// Middleware to parse incoming request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { retryQuery } = require('./utils/retryHelper'); // Import the retryQuery function


// Set EJS as the view engine
app.set('view engine', 'ejs');

// Set the views directory where EJS templates are located
app.set('views', path.join(__dirname, 'views'));


// Set up sessions
app.use(session({
    secret: 'process.env.SESSION_CODE',
    resave: false,
    saveUninitialized: true
}));


// Database connection pool using connection string from .env file
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Ensure secure connections
});

// Serve static files (e.g., CSS)
app.use(express.static('public'));

// Serve the login page
app.get('/login', (req, res) => {
    // if (req.isAuthenticated()) {
    //     // Redirect to the dashboard if the user is already logged in
    //     user = req.session.user;
    //     if (user && user.role === 'super_admin') {
    //     res.redirect('/super-admin-dashboard');
    // } else if (user && user.role === 'admin' || user.role === 'vice_admin') {
    //     res.redirect('/admin-dashboard');
    // } else if (user && user.role === 'student') {
    //     res.redirect('/student-dashboard');
    // }}

    res.render('login'); // Render the login EJS page
    
});

app.get('/',(req,res)=>{
    res.render('home');
});

app.get('/home',(req,res)=>{
    res.render('home');
});

app.get('/register', async (req, res) => {
    try {
        // Fetch all schools from the database
        const result = await pool.query('SELECT * FROM schools'); // Adjust this query based on your schema
        const schools = result.rows; // Array of schools from the database

        // Render the register page with schools data
        res.render('register', { schools: schools });
    } catch (error) {
        console.error('Error fetching schools:', error);
        res.status(500).send('Server Error');
    }
});


app.get('/upload-results', async (req, res) => {
    try {
        const schools = await pool.query('SELECT * FROM schools');
        const schoolname = req.session.user.schoolname;
        res.render('uploadResults', { schools: schools.rows , schoolname});
    } catch (error) {
        console.error('Error fetching schools:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Endpoint for registering a school
app.post('/register-school', async (req, res) => {
    const { name, email, password,number,address} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Insert school into the database
        const result = await pool.query(
            'INSERT INTO Schools (name, email, super_admin_id,mobile_number,address) VALUES ($1, $2, NULL,$3,$4) RETURNING id',
            [name, email,number,address] // Insert school name and address
        );
        const resid = await pool.query(
            'INSERT INTO Users (username,email,password,role,school_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            ['super_admin',email,hashedPassword,'super_admin',result.rows[0].id]
        );

        await pool.query(
            'UPDATE Schools SET super_admin_id = ($1) where email = ($2)',
            [resid.rows[0].id,email]
        );

        res.redirect('/login'); // Redirect to login page after registration
    } catch (err) {
        console.error('Error registering school:', err);
        res.status(500).json({ error: 'Error registering school' });
    }
});

// Endpoint for registering an admin
app.post('/register-admin', async (req, res) => {
    const { username, password, email, school_id } = req.body;

    try {
        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert admin into the database
        const result = await pool.query(
            'INSERT INTO registrationrequests (username, email, password, role, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [username, email, hashedPassword, 'admin', school_id]
        );
        res.redirect('/login'); // Redirect to login page after registration
    } catch (err) {
        console.error('Error registering admin:', err);
        res.status(500).json({ error: 'Error registering admin' });
    }
});

// Endpoint for registering a student
app.post('/register-student', async (req, res) => {
    const { username, email, roll_number, school_id, password, class_name } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert student into the database
        const result = await pool.query(
            'INSERT INTO registrationrequests (username, email, password, role, school_id, class, roll_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [username, email, hashedPassword, 'student', school_id,  class_name , roll_number]
        );
        res.redirect('/login'); // Redirect to login page after registration
    } catch (err) {
        console.error('Error registering student:', err);
        res.status(500).json({ error: 'Error registering student' });
    }
});



// Endpoint for user login
app.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    try {
        // Query to find the user by email and role
        const findUserQuery = async () => {
            return await pool.query('SELECT * FROM users WHERE email = $1 AND (role = $2 OR role = $3)', [email, role,'vice_admin']);
        };

        // Retry fetching user data from the database
        const result = await retryQuery(findUserQuery);
        const user = result.rows[0];

        if (user) {
            // Query to fetch school name based on school_id
            const findSchoolQuery = async () => {
                return await pool.query('SELECT * FROM schools WHERE id = $1', [user.school_id]);
            };

            // Retry fetching school name from the database
            const schoolNameResult = await retryQuery(findSchoolQuery);
            const school_nname = schoolNameResult.rows[0];

            // Compare the password with the hashed password in the database
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (isPasswordValid) {
                // If credentials are correct, create session for the user
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    username: user.username || user.email, // Use username if available, fallback to email
                    school_id: user.school_id || null, // Add school_id for filtering requests
                    schoolname: school_nname || null,
                };

                // Redirect to the appropriate dashboard based on the role
                res.redirect('/dashboard');
            } else {
                // If password is incorrect, show error message
                res.status(400).json({ error: 'Invalid password' });
            }
        } else {
            // If no user is found with that email and role, show error message
            res.status(400).json({ error: 'Invalid email or role' });
        }
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});


app.get('/dashboard',async(req,res)=>{
    try{
        user = req.session.user;
        if (user.role === 'super_admin') {
            res.redirect('/super-admin-dashboard');
        } else if (user.role === 'admin' || user.role === 'vice_admin') {
            res.redirect('/admin-dashboard');
        } else if (user.role === 'student') {
            res.redirect('/student-dashboard');
        }else{
            res.redirect('/login');
        }
    }catch{
        res.redirect('/login');
    }
})


// app.post('/login', async (req, res) => {
//     const { email, password, role } = req.body;

//     try {
//         // Find the user by email and role
//         const query = `SELECT id, email, username, role, school_id, password FROM Users WHERE email = $1 AND role = $2`;
//         const result = await pool.query(query, [email, role]);
//         const user = result.rows[0];

//         if (!user) {
//             return res.status(400).json({ error: 'Invalid email, password, or role' });
//         }

//         // Compare the password with the hashed password in the database
//         const isPasswordValid = await bcrypt.compare(password, user.password);
//         if (!isPasswordValid) {
//             return res.status(400).json({ error: 'Invalid email, password, or role' });
//         }

//         // If credentials are correct, store user details in session
//         req.session.user = {
//             id: user.id,
//             email: user.email,
//             role: user.role,
//             username: user.username || user.email, // Use username if available, fallback to email
//             school_id: user.school_id || null, // Add school_id for filtering requests
//         };

//         // Redirect to the appropriate dashboard based on role
//         if (user.role === 'super_admin') {
//             res.redirect('/super-admin-dashboard');
//         } else if (user.role === 'admin') {
//             res.redirect('/admin-dashboard');
//         } else if (user.role === 'student') {
//             res.redirect('/student-dashboard');
//         } else {
//             res.status(400).send('Invalid role');
//         }
//     } catch (err) {
//         console.error('Error logging in:', err);
//         res.status(500).json({ error: 'Server error during login' });
//     }
// });



app.post('/upload-results', upload.single('resultFile'), async (req, res) => {
    const { school, class: className, subject, total_marks, exam_number} = req.body;
    const filePath = req.file.path;

    try {
        const results = [];

        if (path.extname(req.file.originalname) === '.csv') {
            // Process CSV file
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        results.push(row);
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        } else if (path.extname(req.file.originalname) === '.xlsx') {
            // Process Excel file
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
            results.push(...sheetData);
        } else {
            throw new Error('Invalid file format. Only CSV and Excel files are supported.');
        }

        // Insert results into the database
        for (const result of results) {
            const {RollNumber: rollNumber, Marks: marks , Name: studentName} = result;
            await pool.query(
                `INSERT INTO results (school_id, class, subject, roll_number, marks, total_marks, exam_number)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [school, className, subject, rollNumber, marks, total_marks, exam_number]
            );
        }

        fs.unlinkSync(filePath); // Clean up the uploaded file
        res.redirect('/admin-dashboard');
    } catch (error) {
        console.error('Error processing results:', error);
        res.status(500).send('Error processing the file. Please try again.');
    }
});



app.get('/view-results', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.status(403).send('Access denied. This page is only for students.');
    }

    const { id, school_id, schoolname } = req.session.user; // Student ID and schoolId from session
    const { examNumber } = req.query;

    if (!examNumber) {
        return res.render('viewResults', { student: req.session.user, school: null, examNumber: null, results: null , schoolname});
    }

    try {
        // Fetch school details
        const schoolResult = await pool.query('SELECT * FROM schools WHERE id = $1', [school_id]);
        const school = schoolResult.rows[0];
        //Fetch student's detailsl for the given id
        const student_details = await pool.query(
            `SELECT * FROM users
            WHERE id = $1`,
            [id]
        );


        student_det = student_details.rows[0];

        // Fetch student's results for the given exam number
        const resultsResult = await pool.query(
            `SELECT subject, marks, total_marks FROM results
            WHERE school_id = $2 AND exam_number = $3 AND class = $1 AND roll_number = $4 `,
            [student_det.class, school_id, examNumber,student_det.roll_number]
        );

        const results = resultsResult.rows;
        res.render('viewResults', {
            student: student_det,
            school,
            examNumber,
            results,
            schoolname,
        });
    } catch (err) {
        console.error('Error fetching results:', err);
        res.status(500).send('Error fetching results. Please try again later.');
    }
});






// Route: Super Admin Page
app.get('/super-admin', async (req, res) => {
    try {
        // Execute the query and fetch results
        const result = await pool.query(
            'SELECT DISTINCT class FROM users WHERE school_id = $1 AND role = $2 ORDER BY class',
            [req.session.user.school_id, 'student']
        );

        // Access rows directly from the query result
        const classes = result.rows; // Adjust based on the library's API (e.g., `mysql2`, `pg`)
        const schoolname = req.session.user.schoolname;
        // Render the page with the fetched classes
        res.render('superAdminPage', { classes: classes.map(c => c.class) , schoolname });
    } catch (error) {
        console.error('Error loading super admin page:', error);
        res.status(500).send('Error loading super admin page.');
    }
});


// Route: Fetch Admins
app.get('/super-admin/admins', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE school_id = $1 AND role = $2 OR role = $3 ORDER BY id',
            [req.session.user.school_id, 'admin','vice_admin']
        );

        // Extract rows based on database library
        const admins = result.rows || result[0]; // PostgreSQL uses `rows`, MySQL uses `[0]`

        // Send the results
        res.json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ error: 'Error fetching admins.' });
    }
});


// Route: Fetch Students by Class
app.get('/super-admin/students', async (req, res) => {
    try {
        const classValue = req.query.class;

        // Execute the query and get results
        const result = await pool.query(
            'SELECT * FROM users WHERE school_id = $1 AND class = $2',
            [req.session.user.school_id, classValue]
        );

        // Adjust how students are accessed based on your database library
        const students = result.rows || result[0]; // Use `.rows` for PostgreSQL, `[0]` for MySQL

        // Respond with the students list
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Error fetching students.' });
    }
});


// Route: Promote or demote Admin to Vice Admin
app.post('/super-admin/promote-demote-admin', async (req, res) => {
    const { adminId, action } = req.body;
    try {
        // Fetch admin by ID from the database
        const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [adminId]);
        const admin = adminResult.rows[0];

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // Promote or demote admin based on the action
        if (admin.role === 'admin') {
            admin.role = 'vice_admin'; // Change role to Vice Admin
        } else if (admin.role === 'vice_admin') {
            admin.role = 'admin'; // Change role back to Admin
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Update the admin's role in the database
        await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2',
            [admin.role, adminId]
        );

        res.status(200).json({ message: `Admin ${action.toLowerCase()}d successfully!` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while updating the admin role.' });
    }
});






// Route to fetch students by class
app.get('/view-students', async (req, res) => {
    const { className } = req.query;
  
    try {
      // Fetch all available classes
      const classesResult = await pool.query('SELECT DISTINCT class FROM users WHERE school_id = $1 ORDER BY class',[req.session.user.school_id]);
      const classes = classesResult.rows.map(row => row.class);
  
      let students = [];
      if (className) {
        // Fetch students in the selected class
        const studentsResult = await pool.query('SELECT * FROM users WHERE class = $1 AND school_id = $2 ORDER BY roll_number', [className,req.session.user.school_id]);
        students = studentsResult.rows;
      }
      const schoolname = req.session.user.schoolname;

      res.render('view-students', { classes, students, className, schoolname });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });
  

// Route to fetch a specific student and their exam results
app.get('/view-student/:id', async (req, res) => {
    const studentId = req.params.id;
  
    try {
      // Fetch student details from the `users` table
      const studentResult = await pool.query('SELECT * FROM users WHERE id = $1', [studentId]);
      const student = studentResult.rows[0];
  
      if (!student) {
        return res.status(404).send('Student not found');
      }
      
      const studentdet = await pool.query('SELECT class,roll_number FROM users WHERE id = $1',[studentId]);
      const studet = studentdet.rows[0];

      // Fetch student exam results from the `results` table
      const resultsResult = await pool.query('SELECT * FROM results WHERE class = $1 AND roll_number = $2 AND school_id = $3 ORDER BY exam_number,id', [studet.class,studet.roll_number,req.session.user.school_id]);
      const results = resultsResult.rows;
      const schoolname = req.session.user.schoolname;

      res.render('view-student-details', { student, results, schoolname });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });
   
  // Route to update student marks
  app.post('/update-marks', async (req, res) => {
    const { studentId, examNumber, subject, marks } = req.body;
    try {
      // Check if a result already exists for the student, exam, and subject

        const rr = await pool.query('SELECT class,roll_number FROM users WHERE id = $1',[studentId]);
        const rrr =rr.rows[0];
      const resultCheck = await pool.query(
        'SELECT * FROM results WHERE class = $1 AND roll_number = $2 AND exam_number = $3 AND subject = $4 AND school_id = $5' ,
        [rrr.class, rrr.roll_number, examNumber, subject, req.session.user.school_id]
      );
      if (resultCheck.rows.length > 0) {
        // Update the marks if the result exists
        await pool.query(
          'UPDATE results SET marks = $1 WHERE class = $2 AND roll_number = $3 AND exam_number = $4 AND subject = $5 AND school_id = $6',
          [marks, rrr.class, rrr.roll_number, examNumber, subject, req.session.user.school_id]
        );
      } else {
        // Insert a new result if it doesn't exist
        // await pool.query(
        //   'INSERT INTO results (class,roll_number, exam_number, subject, marks,school_id,total_marks) VALUES ($1, $2, $3, $4,$5,$6,$7)',
        //   [rrr.class,rrr.roll_number, examNumber, subject, marks,req.session.user.school_id,'100']
        // );
        console.log("Does not exist");
      }
  
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });


  app.post('/add-result', async (req, res) => {
    const { studentId, examNumber, subject, marks, total } = req.body;
    const rr = await pool.query('SELECT class,roll_number FROM users WHERE id = $1',[studentId]);
    const rrr =rr.rows[0];
    try {
        await pool.query(
              'INSERT INTO results (class,roll_number, exam_number, subject, marks,school_id,total_marks) VALUES ($1, $2, $3, $4,$5,$6,$7)',
              [rrr.class,rrr.roll_number, examNumber, subject, marks,req.session.user.school_id,total]
            );
  
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  });
  
 


// // Route: Edit Admin or Student Details
// app.post('/super-admin/edit', async (req, res) => {
//     try {
//         const { id, table, updates } = req.body; // `table` should be either 'admins' or 'students'
//         const updateKeys = Object.keys(updates).map(key => `${key} = ?`).join(', ');
//         const updateValues = Object.values(updates);

//         await db.query(`UPDATE ${table} SET ${updateKeys} WHERE id = ?`, [...updateValues, id]);
//         res.json({ success: true });
//     } catch (error) {
//         console.error('Error editing details:', error);
//         res.status(500).json({ error: 'Error editing details.' });
//     }
// });



//profile page details


app.get('/profile', async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
      return res.redirect('/login'); // Redirect to login if not authenticated
    }
  
    try {
      const studentId = req.session.user.id; // Get the student ID from session
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [studentId]);
  
      if (result.rowCount === 0) {
        return res.status(404).send('Student not found.');
      }
  
      const student = result.rows[0];
      const schoolname = req.session.user.schoolname;
      res.render('profile', { student, schoolname }); // Pass the student data to the EJS page
    } catch (err) {
      console.error('Error fetching profile:', err);
      res.status(500).send('Internal Server Error');
    }
  });
  

  app.post('/update-profile', async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
      return res.redirect('/login'); // Redirect to login if not authenticated
    }
  
    const { studentId, username, email, class: studentClass, rollNumber } = req.body;
  
    if (!studentId || !username || !email || !studentClass || !rollNumber) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
      await pool.query(
        `UPDATE users 
         SET username = $1, email = $2, class = $3, roll_number = $4 
         WHERE id = $5`,
        [username, email, studentClass, rollNumber, studentId]
      );
  
      res.json({ success: true, message: 'Profile updated successfully!' });
    } catch (err) {
      console.error('Error updating profile:', err);
      console.log(err);
      res.status(500).json({ success: false, message: 'Error updating profile.' });
    }
  });
  

  
  app.post('/reset-password', async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
      return res.redirect('/login'); // Redirect to login if not authenticated
    }
  
    const { password } = req.body;
    const studentId = req.session.user.id;
  
    if (!password || password.length < 5) {
      return res.status(400).send('Password must be at least 5 characters.');
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
  
      await pool.query(
        `UPDATE users 
         SET password = $1 
         WHERE id = $2`,
        [hashedPassword, studentId]
      );
      res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err) {
      console.error('Error updating password:', err);
      res.status(500).json({ success: false, message: 'Error updating password.' });
    }
  });
  









// Super Admin Dashboard Route
app.get('/super-admin-dashboard', (req, res) => {
    try{
        if (!req.session.user.id || req.session.user.role !== 'super_admin') {
            console
            return res.redirect('/login'); // Redirect to login if not a super admin
        }
        const schoolname = req.session.user.schoolname;
        res.render('superAdminDashboard', { username: req.session.user.username, schoolname });
    }catch{
        res.redirect('/login');
    }
});

// Admin Dashboard Route
app.get('/admin-dashboard', (req, res) => {
    try{
        if (!req.session.user.id || (req.session.user.role !== 'admin') && (req.session.user.role !== 'vice_admin')) {
            return res.redirect('/login'); // Redirect to login if not an admin
        }
        const schoolname = req.session.user.schoolname;
        res.render('adminDashboard', { role: req.session.user.role, username: req.session.user.username, schoolname });    
    }catch{
        res.redirect('/login');
    }
});

// Student Dashboard Route
app.get('/student-dashboard', (req, res) => {
    try{
        if (!req.session.user.id || req.session.user.role !== 'student') {
            return res.redirect('/login'); // Redirect to login if not a student
        }
        const schoolname = req.session.user.schoolname;
        res.render('studentDashboard', { username: req.session.user.username , schoolname});
    }catch{
        res.redirect('/login');
    }
});



// Route to handle registration request actions
app.post('/handle-request', async (req, res) => {
    const { requestId, role, action } = req.body;

    try {
        if (action === 'accept') {
            // Fetch request details
            const requestResult = await pool.query(
                'SELECT * FROM registrationrequests WHERE id = $1',
                [requestId]
            );
            const request = requestResult.rows[0];

            if (!request) {
                return res.status(404).send('Request not found');
            }

            // Add user to users table
            await pool.query(
                'INSERT INTO users (username, email, password, role, school_id, class, roll_number) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [
                    request.username,
                    request.email,
                    request.password, // Ensure passwords are hashed before storing
                    request.role,
                    request.school_id || null,
                    request.class || null,
                    request.roll_number || null,
                ]
            );

            // Remove request from registration_requests table
            await pool.query('DELETE FROM registrationrequests WHERE id = $1', [
                requestId,
            ]);

            console.log('Request accepted and user added.');
        } else if (action === 'reject') {
            // Remove request from registration_requests table
            await pool.query('DELETE FROM registrationrequests WHERE id = $1', [
                requestId,
            ]);

            console.log('Request rejected.');
        }

        res.redirect('/view-requests'); // Redirect back to the requests page
    } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).send('Server Error');
    }
});






// Route to render registration requests page for Super Admin
app.get('/view-requests', async (req, res) => {
    try {
        // Check if the user is logged in and is a super admin
        if (!req.session.user || ((req.session.user.role !== 'super_admin') && (req.session.user.role !== 'vice_admin'))) {
            console.log(req.session.user.role);
            return res.status(403).send('Access denied');
        }

        // Fetch the school_id of the logged-in super admin
        const schoolId = req.session.user.school_id;

        // Fetch all requests belonging to the same school
        const requestsQuery = `
            SELECT * 
            FROM registrationrequests 
            WHERE school_id = $1
        `;
        const result = await pool.query(requestsQuery, [schoolId]);
        const requests = result.rows;
        const schoolname = req.session.user.schoolname;

        // Render the view-requests page with the filtered requests
        res.render('view-requests', { requests , schoolname});
    } catch (err) {
        console.error('Error fetching registration requests:', err);
        res.status(500).send('An error occurred while fetching registration requests.');
    }
});





// Endpoint for logging out
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
