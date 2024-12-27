# ResultHub

## Description
**ResultHub** is a web-based application designed for managing and tracking student results. The platform is tailored for both students and admins (teachers/professors), with separate features for each role. Admins can manage student accounts and upload results, while students can view their individual results. The project aims to facilitate efficient result tracking and provide useful insights into student performance.

## Features

### Admin Features
- **Manage Student Accounts**: Admins (teachers/professors) can add, update, and delete student accounts.
- **Upload and Manage Results**: Admins can upload and update student results.
- **View Results**: Admins can view all student results in a tabular format.

### Student Features
- **View Personal Results**: Students can view their own results.
- **Track Academic Performance**: Students can track their results over time and compare different subjects or terms.

## Tech Stack

### Frontend
- **HTML/CSS**: For creating the structure and styling of the web pages.
- **JavaScript**: For dynamic features and interactivity.

### Backend
- **Node.js**: Backend runtime for handling requests and server logic.
- **Express.js**: Web framework for building the server and API routes.

### Database
- **SQL (MySQL/PostgreSQL)**: Relational database to store user information and student results.

### Authentication
- **Passport.js**: For user authentication, with different roles for admins and students.

## Usage

### 1. **Sign Up and Log In**

- **For Admins**: 
  - Admins (teachers/professors) can create accounts by signing up with their email and password. 
  - Once logged in, admins can manage student accounts, upload, and view results for all students.
  
- **For Students**: 
  - Students can sign up and log in using their email and password.
  - After logging in, students can view their individual academic results and track their performance over time.

### 2. **Admin Dashboard**

Once logged in as an admin, you can access the Admin Dashboard to perform the following actions:
- **Manage Student Accounts**: Admins can add new student accounts, update existing accounts, and delete students if needed.
- **Upload Student Results**: Admins can upload the results for students through a simple interface. The results are saved in the database and linked to the appropriate student account.
- **View and Edit Results**: Admins can view the results for any student in a tabular format, as well as edit or delete specific result entries if necessary.

### 3. **Student Dashboard**

Once logged in as a student, you will be directed to the Student Dashboard where you can:
- **View Your Results**: Students can view their own academic results. The results will be displayed in a table format, showing grades, subjects, and other relevant details.
- **Track Performance**: Students can track their academic performance over different terms or subjects. They can compare their results to see improvements or areas where they need more focus.

### 4. **Result Management**

- **Admins**: Can upload and update student results, ensuring that all data is up to date.
- **Students**: Can only view their results, not edit or upload new data.

### 5. **Access Control**
- **Admin**: Full access to all student data, account management, and result uploads.
- **Student**: Restricted to viewing only their own results, with no permission to modify any data.

##Screenshots
-Home Page
![Screenshot 2024-12-27 173906](https://github.com/user-attachments/assets/9d09ca29-586a-4a8d-b6e8-b653c59776dd)
![Screenshot 2024-12-27 173949](https://github.com/user-attachments/assets/2b1a08c0-1dfd-4ad9-8e3f-693935000b65)



## Installation

Follow these steps to get the project running locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Krishna-JK-14/ResultHub.git


   
