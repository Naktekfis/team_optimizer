# Team Maker

Aplikasi web untuk membagi mahasiswa ke dalam tim yang optimal berdasarkan:
- **Minat/Kompetensi** (P1, P2, P3): Distribusi merata antar tim
- **MBTI**: Keseimbangan kepribadian (I/E, N/S, T/F, J/P)
- **Inkompatibilitas**: Hindari mahasiswa yang tidak cocok satu tim

Menggunakan **Genetic Algorithm** dengan parallelization untuk hasil optimal dalam waktu singkat.

---

## Quick Start

### 1. Setup
```bash
# Clone atau download project
git clone https://github.com/Naktekfis/team_optimizer.git
cd team_optimizer

# Buka aplikasi
# Klik 2x file: team_optimizer.html
# Atau buka di browser langsung
```

---

## Cara Pakai

### Step 1: Upload Data Mahasiswa

**Format Excel/CSV diperlukan:**

| No | NIM | Nama | P1 | P2 | P3 | I | E | N | S | T | F | J | P |
|----|-----|------|----|----|----|----|----|----|----|----|----|----|-----|
| 1  | 1301210001 | Ahmad | 2 | 1 | 2 | I |  | N |  | T |  | J |  |
| 2  | 1301210002 | Budi  | 1 | 2 | 1 |  | E |  | S |  | F |  | P |

**Kolom wajib:**
- `No`, `NIM`, `Nama`: Identitas
- `P1`, `P2`, `P3`: Minat (angka 1-3, prioritas tertinggi=1)
- `I/E`, `N/S`, `T/F`, `J/P`: MBTI (isi satu per pasang)

**Tips:**
- Gunakan `sample_students.xlsx` sebagai template
- Generate data dummy: lihat panduan di bawah

<details>
<summary>📦 Cara install & jalankan <code>create_sample_data.py</code></summary>

**1. Cek apakah Python sudah terinstall:**
```bash
python --version
# atau
python3 --version
```

**2. Jika Python belum ada, install terlebih dahulu:**

- **Windows:** Download dari [python.org](https://www.python.org/downloads/) → saat install, centang ✅ **"Add Python to PATH"**
- **macOS:**
  ```bash
  brew install python3
  ```
- **Ubuntu / Debian:**
  ```bash
  sudo apt update && sudo apt install python3 python3-pip
  ```

**3. Install dependensi Python:**
```bash
pip install openpyxl
# atau jika pakai pip3:
pip3 install openpyxl
```

**4. Jalankan script:**
```bash
python create_sample_data.py
# atau:
python3 create_sample_data.py
```

Script akan menghasilkan file `sample_students.xlsx` yang siap diupload ke aplikasi.

</details>

---

### Step 2: Set Inkompatibilitas (Opsional)

Tentukan mahasiswa yang **tidak boleh** satu tim:

```
Klik "Add Incompatibility"
→ Pilih Mahasiswa A
→ Pilih Mahasiswa B
→ Tambah alasan (opsional)
```

Contoh: Konflik personal, pernah bekerja buruk bersama, dll.

---

### Step 3: Konfigurasi Tim

**Setting dasar:**
- **Jumlah Tim**: Berapa tim yang diinginkan
- **Min/Max Ukuran**: Batas anggota per tim
- **Bobot**:
  - `w_minat`: Pentingnya keseimbangan minat (default: 40)
  - `w_mbti`: Pentingnya keseimbangan MBTI (default: 40)
  - `w_incomp`: Pentingnya menghindari inkompatibilitas (default: 20)

**Advanced** (opsional):
- `popSize`: Ukuran populasi GA (200-500)
- `maxGen`: Generasi maksimal (300-1000)
- `ensembleN`: Jumlah run parallel (5-20, lebih tinggi = lebih akurat tapi lebih lama)

---

### Step 4: Generate Teams

Klik **"Generate Teams"** → Tunggu hingga selesai

**Proses:**
```
Preprocessing → Running GA (parallel) → Evaluating → Complete
```

**Hasil:**
- Visualisasi distribusi minat & MBTI per tim
- Daftar anggota per tim dengan detail
- Skor kualitas pembagian
- Export ke Excel/CSV

---

## Edit File Penting

### 1. Ubah Algoritma GA
Edit bagian algorithm di `team_optimizer.html`:

```javascript
// Cari baris ~1800-2200
function geneticAlgorithm(W_norm, M, inc, k, ...) {
  // Modifikasi di sini:
  // - crossover: cara kawin silang
  // - mutate: cara mutasi
  // - evaluateFitness: fungsi skor
}
```

### 2. Ubah Bobot Default
```javascript
// Cari baris ~2800
const CONFIG = {
  w_minat: 40,    // ← Ubah ini
  w_mbti: 40,     // ← Ubah ini
  w_incomp: 20,   // ← Ubah ini
  popSize: 200,
  maxGen: 500,
  // ...
}
```

### 3. Ubah Tampilan/Style
Edit CSS di baris 9-500:
```css
:root {
  --accent: #3b82f6;  /* ← Warna primary */
  --bg: #0a0e1a;      /* ← Background */
  /* ... */
}
```

### 4. Ubah Validasi Input
```javascript
// Cari fungsi parseExcel (~baris 1200)
function parseExcel(workbook) {
  // Validasi format
  // Tambah/ubah kolom yang diperlukan
}
```

---

## Troubleshooting

**❌ "Invalid file format"**
→ Pastikan file Excel/CSV punya kolom No, NIM, Nama, P1-P3, I/E, N/S, T/F, J/P

**❌ "Not enough students"**
→ Minimal butuh 2x jumlah tim (mis: 8 tim = min 16 mahasiswa)

**❌ Hasil tidak optimal**
→ Naikkan `ensembleN` (jadi 20-30) dan `maxGen` (jadi 800-1000)

**❌ Terlalu lama**
→ Kurangi `ensembleN` atau gunakan PC dengan CPU lebih banyak core

---

## Tech Stack

- **Frontend**: Vanilla JS (no framework)
- **Algorithm**: Genetic Algorithm dengan ensemble voting
- **Parallelization**: Web Workers (auto-detect CPU cores)
- **Charts**: Chart.js
- **Excel**: SheetJS (xlsx)

---

## Files

```
team_optimizer/
├── team_optimizer.html          # Aplikasi utama (all-in-one)
├── sample_students.xlsx         # Contoh data
├── create_sample_data.py        # Generator data dummy
├── QUICK_REFERENCE.txt          # Dokumentasi teknis
└── README.md                    # You are here
```

