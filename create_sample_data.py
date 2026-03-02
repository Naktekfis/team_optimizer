#!/usr/bin/env python3
"""Create sample student data for testing Team Maker"""

import openpyxl
from openpyxl import Workbook

# Create workbook
wb = Workbook()
ws = wb.active
ws.title = "Students"

# Headers
headers = [
    "No",
    "NIM",
    "Nama",
    "P1",
    "P2",
    "P3",
    "I",
    "E",
    "N",
    "S",
    "T",
    "F",
    "J",
    "P",
]
ws.append(headers)

# Sample student data (20 students for testing)
students = [
    [1, "1301210001", "Ahmad Rizki", 2, 1, 2, "I", "", "N", "", "T", "", "J", ""],
    [2, "1301210002", "Budi Santoso", 1, 2, 1, "", "E", "", "S", "", "F", "", "P"],
    [3, "1301210003", "Citra Dewi", 2, 2, 1, "I", "", "N", "", "", "F", "J", ""],
    [4, "1301210004", "Doni Prakoso", 1, 1, 2, "", "E", "N", "", "T", "", "", "P"],
    [5, "1301210005", "Eka Putri", 2, 1, 1, "I", "", "", "S", "", "F", "J", ""],
    [6, "1301210006", "Fajar Ramadan", 1, 2, 2, "", "E", "N", "", "T", "", "J", ""],
    [7, "1301210007", "Gita Sari", 2, 1, 1, "I", "", "N", "", "", "F", "", "P"],
    [8, "1301210008", "Hendra Wijaya", 1, 1, 1, "", "E", "", "S", "T", "", "J", ""],
    [9, "1301210009", "Indah Permata", 2, 2, 2, "I", "", "N", "", "", "F", "J", ""],
    [10, "1301210010", "Joko Susilo", 1, 2, 1, "", "E", "", "S", "T", "", "", "P"],
    [11, "1301210011", "Kartika Sari", 2, 1, 2, "I", "", "N", "", "T", "", "J", ""],
    [12, "1301210012", "Lukman Hakim", 1, 1, 1, "", "E", "", "S", "", "F", "", "P"],
    [13, "1301210013", "Maya Anggraini", 2, 2, 1, "I", "", "N", "", "", "F", "J", ""],
    [14, "1301210014", "Nanda Pratama", 1, 2, 2, "", "E", "N", "", "T", "", "J", ""],
    [15, "1301210015", "Olivia Tan", 2, 1, 1, "I", "", "", "S", "", "F", "", "P"],
    [16, "1301210016", "Putra Mahendra", 1, 1, 2, "", "E", "N", "", "T", "", "J", ""],
    [17, "1301210017", "Qori Amalia", 2, 2, 1, "I", "", "N", "", "", "F", "J", ""],
    [18, "1301210018", "Rendi Saputra", 1, 2, 2, "", "E", "", "S", "T", "", "", "P"],
    [19, "1301210019", "Sinta Wulandari", 2, 1, 1, "I", "", "N", "", "", "F", "J", ""],
    [20, "1301210020", "Tono Sugiarto", 1, 1, 2, "", "E", "", "S", "T", "", "J", ""],
]

# Add data
for student in students:
    ws.append(student)

# Save file
filename = "sample_students.xlsx"
wb.save(filename)
print(f"✅ Created {filename} with {len(students)} students")
