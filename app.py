
from flask import Flask, render_template, request, redirect, url_for, jsonify
from datetime import date, timedelta
import os, json

app = Flask(__name__)

DATA_FILE = "tasks.json"
STATUSES = ["New", "In Progress", "Blocked", "Complete"]

def load_tasks():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {}

def save_tasks(tasks):
    with open(DATA_FILE, "w") as f:
        json.dump(tasks, f, indent=2)

def rollover_tasks():
    tasks = load_tasks()
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    if yesterday in tasks:
        carry_forward = [t for t in tasks[yesterday] if t.get("status") != "Complete"]
        tasks.setdefault(today, [])
        existing_today = {(t.get("task"), t.get("comment","")) for t in tasks[today]}
        for t in carry_forward:
            key = (t.get("task"), t.get("comment",""))
            if key not in existing_today:
                tasks[today].append({
                    "task": t.get("task",""),
                    "comment": t.get("comment",""),
                    "status": t.get("status") if t.get("status") != "Complete" else "New"
                })

    tasks.setdefault(today, [])
    save_tasks(tasks)

def split_by_status(task_list):
    active = [t for t in task_list if t.get("status") != "Complete"]
    completed = [t for t in task_list if t.get("status") == "Complete"]
    return active, completed

@app.route("/")
def index():
    rollover_tasks()
    tasks = load_tasks()
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    today_display = f"{date.today():%A} ({date.today():%d/%m/%Y})"
    yesterday_display = f"{(date.today() - timedelta(days=1)):%A} ({(date.today() - timedelta(days=1)):%d/%m/%Y})"

    archives = {d: t for d, t in sorted(tasks.items()) if d not in (today, yesterday)}

    today_active, today_completed = split_by_status(tasks.get(today, []))
    y_active, y_completed = split_by_status(tasks.get(yesterday, []))

    return render_template("index.html",
                           today=today,
                           today_display=today_display,
                           yesterday_display=yesterday_display,
                           today_active=today_active,
                           today_completed=today_completed,
                           yesterday_active=y_active,
                           yesterday_completed=y_completed,
                           archives=archives,
                           statuses=STATUSES)

@app.route("/add/<task_date>", methods=["POST"])
def add_task(task_date):
    tasks = load_tasks()
    tasks.setdefault(task_date, [])
    tasks[task_date].append({
        "task": request.form["task"],
        "comment": request.form.get("comment",""),
        "status": "New"
    })
    save_tasks(tasks)
    return redirect(url_for("index"))

@app.route("/status/<task_date>/<int:task_index>", methods=["POST"])
def change_status(task_date, task_index):
    tasks = load_tasks()
    if task_date in tasks and 0 <= task_index < len(tasks[task_date]):
        tasks[task_date][task_index]["status"] = request.form["status"]
        save_tasks(tasks)
    return redirect(url_for("index"))

@app.route("/comment/<task_date>/<int:task_index>", methods=["POST"])
def change_comment(task_date, task_index):
    tasks = load_tasks()
    if task_date in tasks and 0 <= task_index < len(tasks[task_date]):
        tasks[task_date][task_index]["comment"] = request.form.get("comment","")
        save_tasks(tasks)
    return redirect(url_for("index"))

@app.route("/reorder/<task_date>", methods=["POST"])
def reorder(task_date):
    tasks = load_tasks()
    if task_date not in tasks:
        return jsonify({"ok": False, "error": "date not found"}), 404
    payload = request.get_json(silent=True) or {}
    new_order = payload.get("order")
    if not isinstance(new_order, list) or not all(isinstance(i, int) for i in new_order):
        return jsonify({"ok": False, "error": "invalid order"}), 400
    original = tasks[task_date]
    if any(i < 0 or i >= len(original) for i in new_order) or len(new_order) != len(original):
        return jsonify({"ok": False, "error": "indices out of range"}), 400
    tasks[task_date] = [original[i] for i in new_order]
    save_tasks(tasks)
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(debug=True)
