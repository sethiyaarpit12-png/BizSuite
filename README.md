# 🧾 BizSuite — Invoice & Tender Manager

A **zero-install, offline-first** business management web application for Indian SMEs.  
Works entirely in your browser — no server, no backend, no subscription.

---

## ✅ Features

| Module | What it does |
|---|---|
| **Invoice Creator** | GST-compliant invoices (IGST / CGST+SGST), Challans, e-Way Bills |
| **Multi-Firm** | Manage multiple companies from one app |
| **Tender Tracker** | Track POs, Tenders, Invoiced Amounts, Payments, Pending |
| **🔗 Auto-Link** | Invoice PO No. auto-updates Tender Tracker invoiced amount |
| **Records** | Full invoice history with search, filter by FY/Firm |
| **Analytics** | Monthly revenue chart, FY-wise table |
| **Catalogue** | Reusable product/service items |
| **Address Book** | Customer addresses for quick fill |
| **PDF Export** | Named by company: `CompanyName_InvNo.pdf` |
| **Backup/Restore** | JSON backup for all data |
| **Dark Mode** | Toggle with one click |

---

## 🚀 How to Use

### Option 1 — Direct (No install needed)
1. Download `BizSuite_Enhanced.html`
2. Open it in **Google Chrome** or **Microsoft Edge**
3. That's it — works offline!

### Option 2 — GitHub Pages (Host online)
1. Fork this repo
2. Go to **Settings → Pages**
3. Set source to `main` branch, root `/`
4. Your app will be live at `https://yourusername.github.io/BizSuite/BizSuite_Enhanced.html`

---

## 📁 Saving PDFs to D:\ Drive (Two Companies)

Since browsers save to Downloads by default, use this folder structure on your PC:

```
D:\
└── Invoices\
    ├── Company_A\
    │   ├── CompanyA_OI_2026_27_0001.pdf
    │   └── CompanyA_OI_2026_27_0002.pdf
    └── Company_B\
        ├── CompanyB_OI_2026_27_0001.pdf
        └── CompanyB_OI_2026_27_0002.pdf
```

**PDF files are already named by company** — e.g. `MyFirmName_OI_2026_27_0001.pdf`  
Just move them from Downloads to the correct folder in D:\

> **Tip:** Right-click Downloads folder → "Move to" → `D:\Invoices\CompanyName\`

---

## 🔗 Invoice No. ↔ Tender/PO Linking

**YES — Invoice Numbers ARE linked to Tender/PO data**, here's how:

### Automatic Link (NEW in this version)
When you save an invoice with a **PO No.** filled in:
- The app searches your **Tender Tracker** for a matching PO entry
- If found → **Invoiced Amount is auto-updated** in the Tender record
- A confirmation toast shows: `🔗 Tender "PO/123" invoiced amount updated!`

### Invoice Number Format
```
OI_2026_27_0001
│   │       │
│   │       └── Serial number (auto-increments per firm per FY)
│   └────────── Financial Year (2026-27)
└────────────── Firm prefix (set in Settings → Edit Firm → Invoice Prefix)
```

### What's stored per Invoice
| Field | Purpose |
|---|---|
| `invNo` | Unique invoice number |
| `po` | PO / Tender reference number |
| `firmId` | Which company issued it |
| `fy` | Financial year (auto from date) |
| `total` | Grand total (used to update Tender invoiced amount) |

---

## 💾 Data Storage

All data is stored in **browser localStorage** — no internet required.  
Use **Backup → Export JSON** regularly to save your data to a file.

---

## 🛠 Fix: Blank PDF Issue

PDFs come out blank if you generate before filling data. The app now shows errors:
- ❌ "Please enter Consignee / Bill To name"
- ❌ "Please add at least one item"

**Correct workflow:**
1. Settings → Add/Edit Firm (add logo, GSTIN, bank details)
2. Create Invoice → Select Firm → Fill consignee + items
3. Click **Save Invoice** (Ctrl+Enter)
4. Click **Generate PDF** (Ctrl+P)

---

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Save Invoice |
| `Ctrl+P` | Generate PDF |
| `Ctrl+Shift+P` | Preview Invoice |
| `Alt+R` | Add item row |

---

## 🗂 Repository Structure

```
BizSuite/
├── BizSuite_Enhanced.html   ← Main application (single file)
├── README.md                ← This file
├── docs/
│   └── SETUP.md             ← Detailed setup guide
└── .github/
    └── ISSUE_TEMPLATE.md    ← Bug report template
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

*Made for Indian SMEs | GST-ready | Works offline | No subscription*
