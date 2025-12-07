from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
from flask_cors import CORS
import mysql.connector
import re
import json
import os
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from dotenv import load_dotenv
from groq import Groq

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)
app.secret_key = 'Vicky@987'
load_dotenv()
# === Groq Client ===
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

# === Student DB ===
try:
    student_conn = mysql.connector.connect(
        host="localhost",
        user="vicky",
        password="Vicky@987",
        database="career_guidance",
        auth_plugin='mysql_native_password'
    )
    student_cursor = student_conn.cursor(dictionary=True)
    print("✔ Student DB connected successfully")
except mysql.connector.Error as e:
    print("❌ Student DB connection failed:", e)
    student_cursor = None
    student_conn = None

# === Mentor DB ===
try:
    mentor_conn = mysql.connector.connect(
        host="localhost",
        user="mentor_user",
        password="MentorPass123",
        database="career_guidance",
        auth_plugin='mysql_native_password'
    )
    mentor_cursor = mentor_conn.cursor(dictionary=True)
    print("✔ Mentor DB connected successfully")
except mysql.connector.Error as e:
    print("❌ Mentor DB connection failed:", e)
    mentor_cursor = None
    mentor_conn = None

# ---------------------- ROUTES ----------------------

@app.route('/')
def home():
    return render_template("homes.html")

@app.route('/register')
def register_page():
    return render_template("register.html")

@app.route('/carpre')
def carpre():
    clicked_username = request.args.get("username")
    if clicked_username and student_cursor:
        student_cursor.execute(
            "SELECT name, username, phno FROM users WHERE username = %s",
            (clicked_username,)
        )
        student = student_cursor.fetchone()
        if student:
            return render_template(
                'carpre.html',
                name=student['name'],
                username=student['username'],
                phno=student['phno']
            )

    if 'username' not in session or session.get('user_type') != 'student':
        return redirect(url_for('home'))

    return render_template('carpre.html',
                           name=session.get('name'),
                           username=session.get('username'),
                           phno=session.get('phno'))

@app.route('/mentor')
def mentor_dashboard():
    if 'username' not in session or session.get('user_type') != 'mentor':
        return redirect(url_for('home'))
    return render_template('mentor.html',
                           name=session.get('name'),
                           username=session.get('username'),
                           phno=session.get('phno'))

@app.route('/admin')
def admin_dashboard():
    if 'username' not in session or session.get('user_type') != 'admin':
        return redirect(url_for('home'))
    return render_template('admin.html',
                           name=session.get('name'),
                           username=session.get('username'))

@app.route('/get-user')
def get_user():
    if 'username' not in session:
        return jsonify({"error": "Not logged in"}), 401
    return jsonify({
        "name": session.get('name'),
        "username": session.get('username'),
        "phno": session.get('phno', ''),
        "type": session.get('user_type')
    })

# ---------------------- LOGIN ----------------------

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get("username")
    dob_or_password = data.get("dob")
    user_type = data.get("user_type")

    if not username or not dob_or_password or not user_type:
        return jsonify({"success": False, "message": "All fields required"}), 400

    try:
        if user_type == "student" and student_cursor:
            student_cursor.execute(
                "SELECT * FROM users WHERE username=%s AND password=%s",
                (username, dob_or_password)
            )
            user = student_cursor.fetchone()
            if user:
                session['name'] = user['name']
                session['username'] = user['username']
                session['phno'] = user['phno']
                session['user_type'] = 'student'
                return jsonify({
                    "success": True,
                    "message": "Student login successful",
                    "redirect": "/carpre",
                    "user": {
                        "name": user['name'],
                        "username": user['username'],
                        "phno": user['phno'],
                        "type": "student"
                    }
                })

        elif user_type == "mentor" and mentor_cursor:
            mentor_cursor.execute(
                "SELECT * FROM mentors WHERE username=%s AND password=%s",
                (username, dob_or_password)
            )
            mentor = mentor_cursor.fetchone()
            if mentor:
                session['name'] = mentor['name']
                session['username'] = mentor['username']
                session['phno'] = mentor['phone']
                session['user_type'] = 'mentor'
                return jsonify({
                    "success": True,
                    "message": "Mentor login successful",
                    "redirect": "/mentor",
                    "user": {
                        "name": mentor['name'],
                        "username": mentor['username'],
                        "phno": mentor['phone'],
                        "type": "mentor"
                    }
                })

        elif user_type == "admin" and username == "admin" and dob_or_password == "admin123":
            session['name'] = "Admin"
            session['username'] = "admin"
            session['user_type'] = "admin"
            return jsonify({
                "success": True,
                "message": "Admin login successful",
                "redirect": "/admin",
                "user": {
                    "name": "Admin",
                    "username": "admin",
                    "type": "admin"
                }
            })

        return jsonify({"success": False, "message": "Invalid credentials"})
    except mysql.connector.Error as e:
        print("DB error:", e)
        return jsonify({"success": False, "message": "Database query failed"}), 500

# ---------------------- REGISTER ----------------------

@app.route('/register-user', methods=['POST'])
def register_user():
    data = request.get_json() or {}
    role = data.get("role")
    name = data.get("name")
    username = data.get("username")
    dob = data.get("dob")
    phone = data.get("phno", "")

    if not role or not name or not username or not dob:
        return jsonify({"success": False, "message": "Role, Name, Username, and DOB required"}), 400

    try:
        if role == "student" and student_cursor and student_conn:
            student_cursor.execute(
                "INSERT INTO users (name, username, password, phno) VALUES (%s, %s, %s, %s)",
                (name, username, dob, phone)
            )
            student_conn.commit()
        elif role == "mentor" and mentor_cursor and mentor_conn:
            mentor_cursor.execute(
                "INSERT INTO mentors (name, username, password, phone) VALUES (%s, %s, %s, %s)",
                (name, username, dob, phone)
            )
            mentor_conn.commit()
        else:
            return jsonify({"success": False, "message": "Invalid role"}), 400

        return jsonify({"success": True, "message": f"{role.capitalize()} registered successfully"})
    except mysql.connector.Error as e:
        print("DB error:", e)
        return jsonify({"success": False, "message": "Failed to register user"}), 500

# ---------------------- LOGOUT ----------------------

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# ---------------------- GET STUDENTS ----------------------

@app.route('/get-students')
def get_students():
    if not student_cursor:
        return jsonify({"success": False, "message": "Student DB connection error"}), 500
    try:
        mentor_username = session.get('username')
        if not mentor_username:
            return jsonify({"success": False, "message": "Not logged in"}), 401

        student_cursor.execute("""
            SELECT username AS id, name AS name, phno AS phone
            FROM users
            WHERE assigned_mentor = %s
        """, (mentor_username,))
        students = student_cursor.fetchall()
        return jsonify({"success": True, "students": students})
    except mysql.connector.Error as e:
        print("DB error:", e)
        return jsonify({"success": False, "message": "Database error"}), 500

# ---------------------- GET SINGLE STUDENT ----------------------

@app.route('/get-student/<student_id>')
def get_student(student_id):
    if not student_cursor:
        return jsonify({"success": False, "message": "Student DB connection error"}), 500
    try:
        # removed email from query
        student_cursor.execute(
            "SELECT username AS id, name, phno AS phone FROM users WHERE username=%s",
            (student_id,)
        )
        
        student = student_cursor.fetchone()
        if not student:
            return jsonify({"success": False, "message": "Student not found"}), 404

        return jsonify(student)
    except mysql.connector.Error as e:
        print("DB error:", e)
        return jsonify({"success": False, "message": "Database error"}), 500

# ---------------------- CAREER AGENT ----------------------

@app.route('/career-questions', methods=['POST'])
def career_questions():
    data = request.get_json() or {}
    answers = data.get('answers', [])
    known_topics_input = data.get('known_topics', [])
    selected_career = data.get('selected_career')

    if not answers:
        return jsonify({"success": False, "message": "No answers provided."})

    prompt = f"""
    You are a professional AI career counselor.
    A student answered the following questions:
    {answers}

    1) Suggest top 3 suitable careers with a brief explanation for each.
    2) Highlight the single best career as "top_career".
    3) Provide 5 essential learning topics for the top career (comma-separated).

    Return STRICTLY valid JSON:
    {{
        "recommendations": [
            {{"career": "Career Name", "reason": "Why this fits"}}
        ],
        "top_career": "Best Career",
        "topics": ["topic1","topic2","topic3","topic4","topic5"]
    }}
    """

    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful AI career guidance assistant."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile"
        )

        output = chat.choices[0].message.content.strip()
        try:
            result_json = json.loads(output)
        except:
            match = re.search(r'\{.*\}', output, re.DOTALL)
            if match:
                result_json = json.loads(match.group())
            else:
                result_json = {
                    "recommendations": [
                        {"career": "Data Analyst", "reason": "Analytical skills"},
                        {"career": "Software Engineer", "reason": "Likes coding"},
                        {"career": "Product Designer", "reason": "Creative interests"}
                    ],
                    "top_career": "Data Analyst",
                    "topics": ["Python", "SQL", "Excel", "Statistics", "Data Visualization"]
                }

        careers = [r['career'] for r in result_json.get('recommendations', [])]
        if selected_career in careers:
            top_career = selected_career
        else:
            top_career = result_json.get("top_career", careers[0] if careers else "Data Analyst")

        topics = result_json.get("topics", [])
        known_topics = [t.strip() for t in known_topics_input]
        missing_topics = [t for t in topics if t not in known_topics]

        def generate_daily_schedule(topics_list, hours_per_day=2):
            if not topics_list: return {}
            time_per_topic = round(hours_per_day / len(topics_list), 2)
            return {t: f"{time_per_topic}h" for t in topics_list}

        def generate_weekly_schedule(topics_list, weekly_hours=10):
            if not topics_list: return {}
            hours_per_day = round(weekly_hours / 7, 2)
            time_per_topic = round(hours_per_day / len(topics_list), 2)
            days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
            return {day: {t: f"{time_per_topic}h" for t in topics_list} for day in days}

        daily_plan = generate_daily_schedule(missing_topics)
        weekly_plan = generate_weekly_schedule(missing_topics)

        if missing_topics:
            starter_guide = f"Step-by-step guide to become a {top_career}: Learn {', '.join(missing_topics)}, practice projects, build portfolio, and develop skills over 6-12 months."
        else:
            starter_guide = f"You already know all core topics for {top_career}. Focus on advanced projects, portfolio building, and real-world practice."

        result_json["action_plan"] = {
            "selected_career": top_career,
            "missing_topics": missing_topics,
            "daily_schedule": daily_plan,
            "weekly_schedule": weekly_plan,
            "starter_guide": starter_guide
        }

        return jsonify({"success": True, "data": result_json})

    except Exception as e:
        print("AI error:", e)
        return jsonify({"success": False, "message": "Failed to fetch career recommendations"})

# ---------------------- PROGRESS TRACKING ----------------------

progress_store = {}  # {username: {topic: percentage}}

@app.route('/update-progress', methods=['POST'])
def update_progress():
    data = request.get_json() or {}
    topic = data.get('topic')
    pct = data.get('percentage')

    if 'username' not in session or not topic or pct is None:
        return jsonify({"success": False, "message": "Missing data"}), 400

    user = session['username']
    if user not in progress_store:
        progress_store[user] = {}
    progress_store[user][topic] = pct
    return jsonify({"success": True, "message": f"Progress updated for {topic}"})

@app.route('/progress-graph')
def progress_graph():
    if 'username' not in session:
        return "Not logged in", 401
    user = session['username']
    data = progress_store.get(user, {})
    if not data:
        return "No progress data to display", 400

    plt.figure(figsize=(8,5))
    topics = list(data.keys())
    percentages = list(data.values())
    plt.bar(topics, percentages, color='skyblue')
    plt.ylim(0,100)
    plt.ylabel("Completion %")
    plt.title(f"{user}'s Learning Progress")
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    plt.close()
    return send_file(buf, mimetype='image/png')

# ---------------------- RUN APP ----------------------

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
