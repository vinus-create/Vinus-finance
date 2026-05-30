import type { LangCode } from '@/lib/i18n'

export interface ReliefI18n {
  label: string
  desc: string
  details: string[]   // Official bullet-point explanations
}

type ReliefGroup = {
  groupKey: string
  categories: string[]
}

// Grouped order for AddReliefSheet display
export const RELIEF_GROUPS: ReliefGroup[] = [
  { groupKey: 'individual', categories: ['individual_self', 'disabled_self'] },
  { groupKey: 'insurance',  categories: ['life_insurance_epf', 'epf_voluntary', 'medical_insurance', 'private_retirement', 'socso_voluntary'] },
  { groupKey: 'medical',    categories: ['medical_expenses', 'serious_illness', 'mental_health', 'vaccination', 'complete_medical_exam'] },
  { groupKey: 'education',  categories: ['self_education', 'sspn'] },
  { groupKey: 'lifestyle',  categories: ['lifestyle', 'lifestyle_additional', 'ev_charging'] },
  { groupKey: 'family',     categories: ['spouse', 'child_unmarried_18', 'child_student', 'child_disabled', 'breastfeeding', 'childcare_fees'] },
  { groupKey: 'housing',    categories: ['housing_loan_interest', 'zakat_fitrah'] },
]

// ─── English ─────────────────────────────────────────────────
const EN: Record<string, ReliefI18n> = {
  individual_self: {
    label: 'Self',
    desc: 'Basic individual relief — every resident taxpayer qualifies',
    details: [
      'Automatic RM 9,000 relief for every resident individual',
      'No receipts or documents needed',
      'Applicable to all tax form types (BE & B)',
    ],
  },
  disabled_self: {
    label: 'Self (Disabled / OKU)',
    desc: 'Additional relief for registered disabled individuals',
    details: [
      'Additional RM 6,000 on top of the standard individual relief',
      'Must be registered with Jabatan Kebajikan Masyarakat (JKM)',
      'Keep OKU card as supporting document',
    ],
  },
  life_insurance_epf: {
    label: 'Life Insurance + EPF',
    desc: 'Combined life insurance premium and EPF contributions — cap RM 7,000',
    details: [
      'Combined cap: RM 7,000 for life insurance premiums + EPF contributions',
      'EPF portion (employer + employee): up to RM 4,000 within the cap',
      'Life insurance / takaful premium: up to RM 3,000 within the cap',
      'Includes Takaful contributions',
      'Keep annual EPF statement (KWSP) and insurance premium receipts',
    ],
  },
  epf_voluntary: {
    label: 'Voluntary EPF (i-Saraan / i-Suri)',
    desc: 'Voluntary EPF contributions for self-employed and housewives',
    details: [
      'i-Saraan: For self-employed, gig workers, and informal sector workers',
      'i-Suri: For housewives / non-working spouses',
      'Only voluntary contributions qualify — not mandatory employer deductions',
      'Cap: RM 3,000 per year',
      'Download annual statement from KWSP website as proof',
    ],
  },
  medical_insurance: {
    label: 'Medical & Education Insurance',
    desc: 'Medical and education insurance premiums for self, spouse and children',
    details: [
      'Covers medical insurance and education insurance premiums',
      'Includes Takaful medical contributions',
      'For self, spouse, and children',
      'Cap: RM 3,000 per year',
      'Keep annual premium payment receipts or Takaful certificates',
    ],
  },
  private_retirement: {
    label: 'Private Retirement Scheme (PRS)',
    desc: 'Contributions to approved Private Retirement Scheme providers',
    details: [
      'Must be contributed to Securities Commission-approved PRS providers',
      'E.g. Public Mutual PRS, CIMB-Principal PRS, Affin Hwang PRS',
      'Cap: RM 3,000 per year',
      'Keep annual PRS contribution statement as proof',
    ],
  },
  socso_voluntary: {
    label: 'Voluntary SOCSO (PERKESO)',
    desc: 'Voluntary SOCSO contributions under Skim Perlindungan Pekerja Sendiri',
    details: [
      'For self-employed, gig workers, and hawkers',
      'Scheme: Skim Perlindungan Pekerja Sendiri (SPS)',
      'Cap: RM 350 per year',
      'Keep annual SOCSO contribution receipt or statement',
    ],
  },
  medical_expenses: {
    label: "Parents' Medical",
    desc: 'Medical, treatment and care costs for parents',
    details: [
      'Covers medical, special needs and carer costs for parents',
      'Includes: doctor fees, specialist consultation, hospitalisation, nursing',
      'Requires receipts from registered medical practitioners',
      'Cap: RM 8,000 per year',
      'Proof: medical receipts naming the parent as patient',
    ],
  },
  serious_illness: {
    label: 'Serious Illness / Disabled Treatment',
    desc: 'Treatment costs for serious disease for self, spouse, or child',
    details: [
      "Serious diseases: cancer, heart disease, kidney failure, AIDS, Parkinson's, leukaemia, Alzheimer's",
      'Also covers: fertility treatment costs, OKU assistive equipment',
      'For self, spouse, and children',
      'Cap: RM 10,000 per year',
      'Keep specialist medical receipts and diagnosis letters',
    ],
  },
  mental_health: {
    label: 'Mental Health',
    desc: 'Mental health assessment and treatment costs',
    details: [
      'Covers psychiatric consultation, therapy, and counselling',
      'Must be conducted by a registered medical practitioner or psychologist',
      'Cap: RM 1,000 per year',
      'Keep receipts from registered practitioners',
    ],
  },
  vaccination: {
    label: 'Vaccination',
    desc: 'Vaccination expenses for self, spouse, and children',
    details: [
      'All recognised vaccines (e.g. flu, pneumococcal, HPV)',
      'For self, spouse, and children',
      'Shared RM 1,000 cap with Complete Medical Examination',
      'Keep vaccination receipts or clinic invoices',
    ],
  },
  complete_medical_exam: {
    label: 'Full Medical Examination',
    desc: 'Complete medical examination costs',
    details: [
      'Covers comprehensive medical check-up packages',
      'Must be done at a registered clinic or hospital',
      'Shared RM 1,000 cap with Vaccination relief',
      'Keep medical examination receipts',
    ],
  },
  self_education: {
    label: 'Self Education',
    desc: 'Fees for skills-upgrading courses at recognised institutions',
    details: [
      'Diploma, degree, or postgraduate studies at recognised institutions',
      'Professional qualifications: accounting, law, technical, Islamic finance',
      'Vocational and skills training courses',
      'Cap: RM 7,000 per year',
      'Keep tuition fee receipts and enrolment letters',
      'Must be at institutions recognised by Malaysian government',
    ],
  },
  sspn: {
    label: 'SSPN Savings (Net)',
    desc: 'Net deposit into National Education Savings Scheme',
    details: [
      'SSPN = Skim Simpanan Pendidikan Nasional (managed by PTPTN)',
      'Net amount = total deposits in the year minus total withdrawals',
      'Cap: RM 8,000 per year (net)',
      'Open an SSPN account at any PTPTN counter or online',
      'Download annual SSPN statement as proof',
    ],
  },
  lifestyle: {
    label: 'Lifestyle',
    desc: 'Books, internet, sports equipment, PC/smartphone — cap RM 2,500',
    details: [
      'Books, journals, and magazines (print or digital)',
      'Monthly internet subscription (personal use)',
      'Personal computer, laptop, smartphone, or tablet',
      'Sports equipment (non-motorised)',
      'Gym membership fees',
      'Cap: RM 2,500 per year',
      'Keep receipts for all purchases',
    ],
  },
  lifestyle_additional: {
    label: 'Lifestyle — Sports (Additional)',
    desc: 'Sports equipment, gym, and competition fees — additional RM 1,000',
    details: [
      'Separate additional RM 1,000 relief on top of the RM 2,500 lifestyle relief',
      'Covers: sports equipment, gym fees, sports competition registration',
      'E.g. badminton rackets, running shoes, marathon entry fees',
      'Keep all purchase receipts and competition registration proof',
    ],
  },
  ev_charging: {
    label: 'EV Charging Facility',
    desc: 'Installation of electric vehicle home charging equipment',
    details: [
      'Costs for purchasing and installing EV charging equipment at home',
      'For personal EV charging use only (not commercial)',
      'Includes: charger unit, installation labour, wiring upgrades',
      'Cap: RM 2,500 per year',
      'Keep purchase invoice and installation certificate',
    ],
  },
  spouse: {
    label: 'Spouse',
    desc: 'Relief for spouse with no income (or income below RM 4,000)',
    details: [
      'Claimable if your spouse has no income OR earns below RM 4,000 annually',
      'Cap: RM 4,000',
      'Cannot be claimed if spouse files taxes separately',
      'Cannot be claimed if spouse is also claiming individual relief',
      "Keep spouse's IC number for records",
    ],
  },
  child_unmarried_18: {
    label: 'Child Under 18',
    desc: 'RM 2,000 per unmarried child below 18 years old',
    details: [
      'RM 2,000 per qualifying child',
      'Child must be unmarried and below 18 years of age',
      'Include all biological and legally adopted children',
      'Keep birth certificates as supporting documents',
    ],
  },
  child_student: {
    label: 'Child in Higher Education',
    desc: 'Child pursuing full-time studies at tertiary level',
    details: [
      'Child must be in full-time diploma/degree or higher study',
      'At a recognised Malaysian or overseas institution',
      'Cap: RM 8,000 per child',
      'If child is also OKU, additional RM 8,000 may apply (child_disabled)',
      'Keep enrolment letter and semester receipts',
    ],
  },
  child_disabled: {
    label: 'Disabled Child (OKU)',
    desc: 'Relief for disabled child registered with JKM',
    details: [
      'Child must be registered with JKM (OKU status)',
      'Cap: RM 6,000',
      'Additional RM 8,000 if the disabled child is also pursuing tertiary education',
      'Keep OKU registration card and birth certificate',
    ],
  },
  breastfeeding: {
    label: 'Breastfeeding Equipment',
    desc: 'Breast milk equipment for children aged 2 years and below',
    details: [
      'Covers breast pumps, milk storage bags, bottles, and related accessories',
      'Child must be 2 years old or below during the assessment year',
      'Cap: RM 1,000 per year',
      'Keep purchase receipts showing the product name',
    ],
  },
  childcare_fees: {
    label: 'Childcare / Kindergarten Fees',
    desc: 'Fees at registered childcare centres or kindergartens',
    details: [
      'Fees paid to childcare centres or kindergartens registered with the relevant authority',
      'Cap: RM 3,000 per year',
      'Must be officially registered (Jabatan Kebajikan Masyarakat or MOE)',
      'Keep official fee receipts from the registered centre',
    ],
  },
  housing_loan_interest: {
    label: 'Housing Loan Interest',
    desc: 'Interest paid on first home loan — property must be rented out',
    details: [
      'Interest paid on housing loan for the FIRST residential property only',
      'The property must be rented out during the assessment year',
      'Cap: RM 10,000 per year',
      'Available for YA 2018–2025',
      'Keep bank loan statement showing interest breakdown and tenancy agreement',
    ],
  },
  zakat_fitrah: {
    label: 'Zakat / Fitrah',
    desc: 'Zakat and fitrah payments — full deduction with no cap',
    details: [
      'Full deduction with no maximum cap',
      'Includes: Zakat Pendapatan, Zakat Perniagaan, Zakat Harta, Fitrah',
      'Payment must be made to LHDN-recognised zakat bodies (e.g. state Zakat boards)',
      'Keep official zakat receipts',
      'Note: Zakat deducted as a tax rebate, not a relief — reduces tax payable directly',
    ],
  },
}

// ─── Bahasa Melayu ────────────────────────────────────────────
const MS: Record<string, ReliefI18n> = {
  individual_self: {
    label: 'Diri Sendiri',
    desc: 'Pelepasan individu asas — layak untuk semua pembayar cukai bermastautin',
    details: [
      'Pelepasan automatik RM 9,000 untuk setiap individu bermastautin',
      'Tiada resit atau dokumen sokongan diperlukan',
      'Terpakai kepada semua jenis borang cukai (BE & B)',
    ],
  },
  disabled_self: {
    label: 'OKU Diri Sendiri',
    desc: 'Pelepasan tambahan untuk individu OKU berdaftar',
    details: [
      'Pelepasan tambahan RM 6,000 di atas pelepasan individu biasa',
      'Mesti berdaftar dengan Jabatan Kebajikan Masyarakat (JKM)',
      'Simpan kad OKU sebagai dokumen sokongan',
    ],
  },
  life_insurance_epf: {
    label: 'Insurans Hayat + KWSP',
    desc: 'Gabungan premium insurans hayat dan caruman KWSP — had RM 7,000',
    details: [
      'Had gabungan: RM 7,000 untuk premium insurans hayat + caruman KWSP',
      'Bahagian KWSP (majikan + pekerja): sehingga RM 4,000 dalam had gabungan',
      'Premium insurans hayat / takaful: sehingga RM 3,000 dalam had gabungan',
      'Termasuk sumbangan Takaful',
      'Simpan penyata KWSP tahunan dan resit premium insurans',
    ],
  },
  epf_voluntary: {
    label: 'KWSP Sukarela (i-Saraan / i-Suri)',
    desc: 'Caruman KWSP sukarela untuk pekerja sendiri dan suri rumah',
    details: [
      'i-Saraan: Untuk pekerja sendiri, pekerja gig, dan sektor tidak formal',
      'i-Suri: Untuk suri rumah / pasangan yang tidak bekerja',
      'Hanya caruman sukarela layak — bukan potongan wajib majikan',
      'Had: RM 3,000 setahun',
      'Muat turun penyata tahunan dari laman web KWSP sebagai bukti',
    ],
  },
  medical_insurance: {
    label: 'Insurans Perubatan & Pendidikan',
    desc: 'Premium insurans perubatan dan pendidikan untuk diri, pasangan dan anak',
    details: [
      'Merangkumi premium insurans perubatan dan insurans pendidikan',
      'Termasuk sumbangan Takaful perubatan',
      'Untuk diri sendiri, pasangan, dan anak-anak',
      'Had: RM 3,000 setahun',
      'Simpan resit pembayaran premium tahunan atau sijil Takaful',
    ],
  },
  private_retirement: {
    label: 'Skim Persaraan Swasta (PRS)',
    desc: 'Caruman kepada pembekal PRS yang diluluskan Suruhanjaya Sekuriti',
    details: [
      'Mesti disumbangkan kepada pembekal PRS yang diluluskan Suruhanjaya Sekuriti',
      'Contoh: Public Mutual PRS, CIMB-Principal PRS, Affin Hwang PRS',
      'Had: RM 3,000 setahun',
      'Simpan penyata caruman PRS tahunan sebagai bukti',
    ],
  },
  socso_voluntary: {
    label: 'PERKESO Sukarela',
    desc: 'Caruman PERKESO sukarela di bawah Skim Perlindungan Pekerja Sendiri',
    details: [
      'Untuk pekerja sendiri, pekerja gig, dan peniaga kecil',
      'Skim: Skim Perlindungan Pekerja Sendiri (SPS)',
      'Had: RM 350 setahun',
      'Simpan resit atau penyata caruman PERKESO tahunan',
    ],
  },
  medical_expenses: {
    label: 'Perubatan Ibu Bapa',
    desc: 'Kos perubatan, rawatan dan penjagaan ibu bapa',
    details: [
      'Merangkumi kos perubatan, keperluan khas dan penjaga untuk ibu bapa',
      'Termasuk: fi doktor, rujukan pakar, kemasukan hospital, penjagaan kejururawatan',
      'Memerlukan resit daripada pengamal perubatan berdaftar',
      'Had: RM 8,000 setahun',
      'Bukti: resit perubatan dengan nama ibu/bapa sebagai pesakit',
    ],
  },
  serious_illness: {
    label: 'Penyakit Serius / OKU',
    desc: 'Kos rawatan penyakit serius untuk diri, pasangan atau anak',
    details: [
      'Penyakit serius: kanser, sakit jantung, kegagalan buah pinggang, AIDS, Parkinson, leukemia, Alzheimer',
      'Juga merangkumi: kos rawatan kesuburan, peralatan bantuan OKU',
      'Untuk diri sendiri, pasangan, dan anak-anak',
      'Had: RM 10,000 setahun',
      'Simpan resit pakar perubatan dan surat diagnosis',
    ],
  },
  mental_health: {
    label: 'Kesihatan Mental',
    desc: 'Kos pemeriksaan dan rawatan kesihatan mental',
    details: [
      'Merangkumi konsultasi psikiatri, terapi, dan kaunseling',
      'Mesti dijalankan oleh pengamal perubatan atau ahli psikologi berdaftar',
      'Had: RM 1,000 setahun',
      'Simpan resit daripada pengamal berdaftar',
    ],
  },
  vaccination: {
    label: 'Vaksinasi Diri & Keluarga',
    desc: 'Kos vaksinasi untuk diri, pasangan, dan anak-anak',
    details: [
      'Semua vaksin yang diiktiraf (contoh: selesema, pneumokokus, HPV)',
      'Untuk diri sendiri, pasangan, dan anak-anak',
      'Had RM 1,000 dikongsi dengan Pemeriksaan Perubatan Penuh',
      'Simpan resit vaksinasi atau invois klinik',
    ],
  },
  complete_medical_exam: {
    label: 'Pemeriksaan Perubatan Penuh',
    desc: 'Kos pemeriksaan perubatan menyeluruh',
    details: [
      'Merangkumi pakej pemeriksaan kesihatan menyeluruh',
      'Mesti dilakukan di klinik atau hospital berdaftar',
      'Had RM 1,000 dikongsi dengan pelepasan Vaksinasi',
      'Simpan resit pemeriksaan perubatan',
    ],
  },
  self_education: {
    label: 'Pendidikan Diri',
    desc: 'Yuran kursus peningkatan kemahiran di institusi yang diiktiraf',
    details: [
      'Diploma, ijazah, atau pengajian pascasiswazah di institusi yang diiktiraf',
      'Kelayakan profesional: perakaunan, undang-undang, teknikal, kewangan Islam',
      'Kursus latihan vokasional dan kemahiran',
      'Had: RM 7,000 setahun',
      'Simpan resit yuran pengajian dan surat pendaftaran',
      'Mesti di institusi yang diiktiraf kerajaan Malaysia',
    ],
  },
  sspn: {
    label: 'SSPN Net Simpanan',
    desc: 'Simpanan bersih dalam Skim Simpanan Pendidikan Nasional',
    details: [
      'SSPN = Skim Simpanan Pendidikan Nasional (diuruskan oleh PTPTN)',
      'Amaun bersih = jumlah deposit dalam tahun tolak jumlah pengeluaran',
      'Had: RM 8,000 setahun (bersih)',
      'Buka akaun SSPN di kaunter PTPTN atau dalam talian',
      'Muat turun penyata SSPN tahunan sebagai bukti',
    ],
  },
  lifestyle: {
    label: 'Gaya Hidup',
    desc: 'Buku, internet, peralatan sukan, komputer/telefon — had RM 2,500',
    details: [
      'Buku, jurnal, dan majalah (bercetak atau digital)',
      'Langganan internet bulanan (kegunaan peribadi)',
      'Komputer peribadi, laptop, telefon pintar, atau tablet',
      'Peralatan sukan (bukan berenjin)',
      'Yuran keahlian gimnasium',
      'Had: RM 2,500 setahun',
      'Simpan resit semua pembelian',
    ],
  },
  lifestyle_additional: {
    label: 'Gaya Hidup Tambahan (Sukan)',
    desc: 'Peralatan sukan, gimnasium dan pendaftaran pertandingan — tambahan RM 1,000',
    details: [
      'Pelepasan tambahan RM 1,000 di atas pelepasan gaya hidup RM 2,500',
      'Merangkumi: peralatan sukan, yuran gimnasium, pendaftaran pertandingan sukan',
      'Contoh: raket badminton, kasut larian, yuran masuk maraton',
      'Simpan semua resit pembelian dan bukti pendaftaran pertandingan',
    ],
  },
  ev_charging: {
    label: 'Kemudahan Pengecas EV',
    desc: 'Kos pemasangan peralatan pengecas kenderaan elektrik di rumah',
    details: [
      'Kos pembelian dan pemasangan peralatan pengecas EV di rumah',
      'Hanya untuk kegunaan pengecasan EV peribadi (bukan komersial)',
      'Termasuk: unit pengecas, buruh pemasangan, peningkatan pendawaian',
      'Had: RM 2,500 setahun',
      'Simpan invois pembelian dan sijil pemasangan',
    ],
  },
  spouse: {
    label: 'Pasangan',
    desc: 'Pelepasan untuk pasangan yang tiada pendapatan (atau pendapatan bawah RM 4,000)',
    details: [
      'Boleh dituntut jika pasangan anda tiada pendapatan ATAU berpendapatan bawah RM 4,000 setahun',
      'Had: RM 4,000',
      'Tidak boleh dituntut jika pasangan mengemukakan cukai secara berasingan',
      'Tidak boleh dituntut jika pasangan juga menuntut pelepasan individu',
      'Simpan nombor kad pengenalan pasangan untuk rekod',
    ],
  },
  child_unmarried_18: {
    label: 'Anak Bawah 18 Tahun',
    desc: 'RM 2,000 untuk setiap anak yang belum berkahwin dan bawah 18 tahun',
    details: [
      'RM 2,000 untuk setiap anak yang layak',
      'Anak mestilah belum berkahwin dan berumur bawah 18 tahun',
      'Termasuk anak kandung dan anak angkat yang sah',
      'Simpan sijil lahir sebagai dokumen sokongan',
    ],
  },
  child_student: {
    label: 'Anak Pelajar IPT',
    desc: 'Anak yang belajar sepenuh masa di peringkat pengajian tinggi',
    details: [
      'Anak mesti dalam pengajian diploma/ijazah atau lebih tinggi secara sepenuh masa',
      'Di institusi Malaysia atau luar negara yang diiktiraf',
      'Had: RM 8,000 setiap anak',
      'Jika anak juga OKU, tambahan RM 8,000 mungkin terpakai (anak_OKU)',
      'Simpan surat pendaftaran dan resit yuran semester',
    ],
  },
  child_disabled: {
    label: 'Anak OKU',
    desc: 'Pelepasan untuk anak kurang upaya yang berdaftar dengan JKM',
    details: [
      'Anak mesti berdaftar dengan JKM (status OKU)',
      'Had: RM 6,000',
      'Tambahan RM 8,000 jika anak OKU juga belajar di peringkat pengajian tinggi',
      'Simpan kad pendaftaran OKU dan sijil lahir',
    ],
  },
  breastfeeding: {
    label: 'Penyusuan Susu Ibu',
    desc: 'Peralatan susu ibu untuk anak berumur 2 tahun ke bawah',
    details: [
      'Merangkumi pam susu, beg simpanan susu, botol, dan aksesori berkaitan',
      'Anak mestilah berumur 2 tahun atau bawah semasa tahun taksiran',
      'Had: RM 1,000 setahun',
      'Simpan resit pembelian dengan nama produk yang jelas',
    ],
  },
  childcare_fees: {
    label: 'Yuran Pusat Jagaan / Tadika',
    desc: 'Yuran pusat jagaan atau tadika yang berdaftar dengan pihak berkuasa berkaitan',
    details: [
      'Yuran dibayar kepada pusat jagaan atau tadika yang berdaftar',
      'Had: RM 3,000 setahun',
      'Mesti berdaftar rasmi (Jabatan Kebajikan Masyarakat atau KPM)',
      'Simpan resit yuran rasmi daripada pusat berdaftar',
    ],
  },
  housing_loan_interest: {
    label: 'Faedah Pinjaman Perumahan',
    desc: 'Faedah pinjaman rumah pertama — hartanah mesti disewakan',
    details: [
      'Faedah dibayar ke atas pinjaman perumahan untuk hartanah kediaman PERTAMA sahaja',
      'Hartanah mesti disewakan semasa tahun taksiran',
      'Had: RM 10,000 setahun',
      'Tersedia untuk YA 2018–2025',
      'Simpan penyata pinjaman bank (dengan pecahan faedah) dan perjanjian sewa',
    ],
  },
  zakat_fitrah: {
    label: 'Zakat / Fitrah',
    desc: 'Bayaran zakat dan fitrah — potongan penuh tanpa had',
    details: [
      'Potongan penuh tanpa had maksimum',
      'Termasuk: Zakat Pendapatan, Zakat Perniagaan, Zakat Harta, Fitrah',
      'Bayaran mesti dibuat kepada badan zakat yang diiktiraf LHDN (contoh: Majlis Agama Islam negeri)',
      'Simpan resit zakat rasmi',
      'Nota: Zakat ditolak sebagai rebat cukai (bukan pelepasan) — mengurangkan cukai yang perlu dibayar secara langsung',
    ],
  },
}

// ─── 中文 ──────────────────────────────────────────────────────
const ZH: Record<string, ReliefI18n> = {
  individual_self: {
    label: '个人减免',
    desc: '基本个人减免 — 所有纳税居民均可享有',
    details: [
      '每位居民纳税人自动享有 RM 9,000 减免',
      '无需任何收据或证明文件',
      '适用于所有报税表格类型（BE 及 B）',
    ],
  },
  disabled_self: {
    label: '残障个人（OKU）',
    desc: '已注册残障人士可享有的额外减免',
    details: [
      '在标准个人减免基础上额外获得 RM 6,000 减免',
      '须在福利部（JKM）完成注册',
      '请妥善保存 OKU 卡作为证明文件',
    ],
  },
  life_insurance_epf: {
    label: '人寿保险 + 公积金（KWSP）',
    desc: '人寿保险保费与公积金缴款合计 — 上限 RM 7,000',
    details: [
      '合计上限：人寿保险保费 + 公积金缴款共 RM 7,000',
      '公积金部分（雇主+雇员）：在合计上限内最高 RM 4,000',
      '人寿保险/回教保险保费：在合计上限内最高 RM 3,000',
      '包含回教保险（Takaful）缴款',
      '请保存年度公积金对账单及保险缴费收据',
    ],
  },
  epf_voluntary: {
    label: '自愿公积金（i-Saraan / i-Suri）',
    desc: '自雇者及家庭主妇的自愿公积金缴款',
    details: [
      'i-Saraan：适用于自雇者、零工经济工作者及非正规就业人员',
      'i-Suri：适用于家庭主妇或无收入配偶',
      '仅自愿缴款部分可申报 — 雇主强制扣款不算',
      '上限：每年 RM 3,000',
      '请从公积金网站下载年度对账单作为证明',
    ],
  },
  medical_insurance: {
    label: '医疗/教育保险',
    desc: '本人、配偶及子女的医疗与教育保险保费',
    details: [
      '涵盖医疗保险及教育保险保费',
      '包含回教医疗保险（Takaful）缴款',
      '适用于本人、配偶及子女',
      '上限：每年 RM 3,000',
      '请保存年度保费缴付收据或 Takaful 证书',
    ],
  },
  private_retirement: {
    label: '私人退休金计划（PRS）',
    desc: '向证券委员会批准的私人退休金服务商缴纳的款项',
    details: [
      '须向马来西亚证券委员会（SC）批准的 PRS 服务商缴纳',
      '例如：Public Mutual PRS、CIMB-Principal PRS、Affin Hwang PRS',
      '上限：每年 RM 3,000',
      '请保存年度 PRS 缴款对账单作为证明',
    ],
  },
  socso_voluntary: {
    label: '自愿社保（PERKESO）',
    desc: '在"自雇人员保障计划"下的自愿社保缴款',
    details: [
      '适用于自雇者、零工经济工作者及小贩',
      '计划名称：Skim Perlindungan Pekerja Sendiri（SPS）',
      '上限：每年 RM 350',
      '请保存年度社保缴款收据或对账单',
    ],
  },
  medical_expenses: {
    label: '父母医疗费',
    desc: '父母的医疗、治疗及护理费用',
    details: [
      '涵盖父母的医疗、特殊需求及护理人员费用',
      '包括：医生诊费、专科会诊、住院费、护理费',
      '须有注册医疗从业者开具的收据',
      '上限：每年 RM 8,000',
      '证明：以父/母为患者姓名的医疗收据',
    ],
  },
  serious_illness: {
    label: '重病/残障治疗',
    desc: '本人、配偶或子女的重病治疗费用',
    details: [
      '重病范围：癌症、心脏病、肾衰竭、艾滋病、帕金森症、白血病、老年痴呆症',
      '亦包括：生育治疗费用、残障辅助器具费用',
      '适用于本人、配偶及子女',
      '上限：每年 RM 10,000',
      '请保存专科医疗收据及诊断证明信',
    ],
  },
  mental_health: {
    label: '心理健康',
    desc: '心理健康评估与治疗费用',
    details: [
      '涵盖精神科会诊、心理治疗及辅导费用',
      '须由注册医疗从业者或心理学家提供服务',
      '上限：每年 RM 1,000',
      '请保存注册从业者开具的收据',
    ],
  },
  vaccination: {
    label: '疫苗接种',
    desc: '本人、配偶及子女的疫苗接种费用',
    details: [
      '适用于所有认可疫苗（如：流感、肺炎球菌、HPV）',
      '适用于本人、配偶及子女',
      '与"全面体检"共享 RM 1,000 上限',
      '请保存疫苗接种收据或诊所发票',
    ],
  },
  complete_medical_exam: {
    label: '全面体检',
    desc: '全面健康检查费用',
    details: [
      '涵盖综合健康体检套餐费用',
      '须在已注册的诊所或医院进行',
      '与"疫苗接种"共享 RM 1,000 上限',
      '请保存体检收据',
    ],
  },
  self_education: {
    label: '自我进修',
    desc: '在认可机构参加技能提升课程的学费',
    details: [
      '在认可机构修读文凭、学士或研究生课程',
      '专业资格：会计、法律、工程技术、伊斯兰金融',
      '职业技能及训练课程',
      '上限：每年 RM 7,000',
      '请保存学费收据及录取通知书',
      '须在马来西亚政府认可的机构修读',
    ],
  },
  sspn: {
    label: '国家教育储蓄（SSPN）净额',
    desc: '存入国家教育储蓄计划的净额',
    details: [
      'SSPN = Skim Simpanan Pendidikan Nasional（由 PTPTN 管理）',
      '净额 = 当年存款总额 减去 当年提款总额',
      '上限：每年净额 RM 8,000',
      '可在 PTPTN 柜台或线上开户',
      '请下载年度 SSPN 对账单作为证明',
    ],
  },
  lifestyle: {
    label: '生活方式',
    desc: '书籍、网络、运动器材、电脑/手机 — 上限 RM 2,500',
    details: [
      '书籍、期刊及杂志（纸本或数字版）',
      '每月网络订阅费用（个人用途）',
      '个人电脑、笔记本电脑、智能手机或平板电脑',
      '非机动运动器材',
      '健身房会员费',
      '上限：每年 RM 2,500',
      '请保存所有购买收据',
    ],
  },
  lifestyle_additional: {
    label: '运动生活方式（额外）',
    desc: '运动器材、健身房及比赛报名费 — 额外 RM 1,000',
    details: [
      '在 RM 2,500 生活方式减免基础上额外享有 RM 1,000 减免',
      '涵盖：运动器材、健身房费用、运动比赛报名费',
      '例如：羽毛球拍、跑步鞋、马拉松报名费',
      '请保存所有购买收据及比赛报名证明',
    ],
  },
  ev_charging: {
    label: '电动车充电设施',
    desc: '在家安装电动车充电设备的费用',
    details: [
      '在家中购买并安装电动车充电设备的费用',
      '仅限个人电动车充电使用（非商业用途）',
      '包括：充电器设备、安装人工费、电线升级费用',
      '上限：每年 RM 2,500',
      '请保存购买发票及安装证书',
    ],
  },
  spouse: {
    label: '配偶减免',
    desc: '无收入配偶（或年收入低于 RM 4,000）可申报',
    details: [
      '配偶无收入 或 年收入低于 RM 4,000 时可申报',
      '上限：RM 4,000',
      '若配偶单独报税则不可申报',
      '若配偶已申报个人减免则不可重复申报',
      '请记录配偶的身份证号码以备查阅',
    ],
  },
  child_unmarried_18: {
    label: '18岁以下未婚子女',
    desc: '每名未婚的18岁以下子女可享 RM 2,000 减免',
    details: [
      '每名符合条件的子女 RM 2,000',
      '子女须为未婚且年龄低于18岁',
      '包括亲生子女及合法收养子女',
      '请保存出生证明作为证明文件',
    ],
  },
  child_student: {
    label: '大学就读子女',
    desc: '在高等学府全日制就读的子女',
    details: [
      '子女须在认可机构全日制修读文凭/学位或更高课程',
      '在马来西亚或海外认可机构均可',
      '上限：每名子女 RM 8,000',
      '若子女亦为残障人士，可另外申报残障子女减免',
      '请保存录取通知书及学期缴费收据',
    ],
  },
  child_disabled: {
    label: '残障子女（OKU）',
    desc: '已在福利部注册的残障子女减免',
    details: [
      '子女须在福利部（JKM）注册（OKU 身份）',
      '上限：RM 6,000',
      '若残障子女同时就读高等院校，可额外申报 RM 8,000',
      '请保存 OKU 注册卡及出生证明',
    ],
  },
  breastfeeding: {
    label: '母乳喂养器材',
    desc: '2岁以下婴儿的母乳喂养相关器材费用',
    details: [
      '涵盖吸奶器、储奶袋、奶瓶及相关配件',
      '评估年度内子女须为2岁或以下',
      '上限：每年 RM 1,000',
      '请保存注明产品名称的购买收据',
    ],
  },
  childcare_fees: {
    label: '托儿所/幼儿园费用',
    desc: '已向相关当局注册的托儿所或幼儿园费用',
    details: [
      '须为已注册的托儿中心或幼儿园收费',
      '上限：每年 RM 3,000',
      '须经福利部或教育部正式注册',
      '请保存注册机构开具的正式收费收据',
    ],
  },
  housing_loan_interest: {
    label: '房贷利息',
    desc: '第一套住宅房屋贷款利息 — 须出租',
    details: [
      '仅限第一套住宅房屋贷款的利息部分',
      '该房屋须在评估年度内出租',
      '上限：每年 RM 10,000',
      '适用于评估年度 2018–2025',
      '请保存银行贷款对账单（含利息明细）及租赁协议',
    ],
  },
  zakat_fitrah: {
    label: '天课/人头税（Zakat/Fitrah）',
    desc: '天课及人头税缴款 — 全额扣除，无上限',
    details: [
      '全额扣除，无最高上限',
      '包括：收入天课、商业天课、财产天课、人头税',
      '须向 LHDN 认可的天课机构缴纳（如：各州伊斯兰宗教局）',
      '请保存正式天课收据',
      '注意：天课作为税务回扣（非减免）处理 — 直接减少应缴税款',
    ],
  },
}

const LOOKUP: Record<LangCode, Record<string, ReliefI18n>> = { en: EN, ms: MS, zh: ZH }

export function getReliefI18n(category: string, lang: LangCode): ReliefI18n {
  return LOOKUP[lang]?.[category] ?? LOOKUP['en'][category] ?? { label: category, desc: '', details: [] }
}
