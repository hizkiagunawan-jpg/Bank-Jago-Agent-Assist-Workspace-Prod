import { Conversation, KnowledgeArticle } from '../types';

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "projects/ph-poc-465208/locations/asia-southeast2/conversations/conv-siti-aminah-1123",
    customerName: "Siti Aminah",
    customerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    email: "siti.aminah@yahoo.co.id",
    phone: "+62 856-7890-1234",
    accountType: "Kantong Tabungan Utama",
    status: "monitoring",
    lastMessage: "Terimakasih informasinya, sangat membantu.",
    lastMessageTime: "09:43 AM",
    messages: [
      {
        id: "s1",
        sender: "bot",
        text: "Halo! Selamat datang di Bank Jago. Ada yang bisa Jagoan bantu hari ini?",
        timestamp: "09:40 AM"
      },
      {
        id: "s2",
        sender: "customer",
        text: "Kartu debit saya hilang di minimarket tadi. Takut disalahgunakan orang, gimana ya?",
        timestamp: "09:41 AM"
      },
      {
        id: "s3",
        sender: "bot",
        text: "Aduh, Jagoan turut prihatin mendengar kartu debit Kak Siti hilang! Jangan khawatir ya Kak, Kakak bisa langsung memblokir kartu sementara melalui aplikasi Jago agar aman terlebih dahulu. Caranya: masuk ke menu 'Kantong', pilih 'Kartu', lalu klik 'Blokir Sementara'.",
        timestamp: "09:41 AM"
      },
      {
        id: "s4",
        sender: "customer",
        text: "Oh gitu, tapi kalau mau buat kartu baru langsung lewat aplikasi juga bisa?",
        timestamp: "09:42 AM"
      },
      {
        id: "s5",
        sender: "bot",
        text: "Betul sekali Kak Siti! Kakak bisa langsung klik 'Buat Kartu Baru' atau 'Minta Pengganti' di menu Kartu.",
        timestamp: "09:42 AM"
      },
      {
        id: "s6",
        sender: "customer",
        text: "Terimakasih informasinya, sangat membantu.",
        timestamp: "09:43 AM"
      }
    ],
    assignedParticipant: "projects/ph-poc-465208/locations/asia-southeast2/conversations/conv-siti-aminah-1123/participants/agent-991",
    agentAssistToken: "mock-access-token-siti-456",
    summary: {
      date: "11 Jun 2026",
      time: "16:32 WIB",
      duration: "03:15 min",
      situation: "Nasabah kehilangan kartu debit fisik Visa Jago di minimarket.",
      action: "System memberikan instruksi pembekuan kartu sementara via tab aplikasi Kantong -> Kartu.",
      resolution: "Y: Ya. Semua masalah dan pertanyaan nasabah berhasil diselesaikan.",
      satisfaction: "N: Nasabah netral atau memiliki perasaan positif di akhir percakapan."
    },
    knowledgeSuggestions: [
      {
        title: "Prosedur Pemblokiran Kartu Debit Jago",
        content: "Blokir kartu debit dapat dilakukan permanen maupun sementara di aplikasi Bank Jago. Pemblokiran permanen tidak dapat dibatalkan, dan nasabah harus memesan kartu pengganti dengan biaya Rp10.000.",
        source: "FAQ Kartu Debit Jago",
        confidence: 0.96
      }
    ]
  }
];

export const JAGO_KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    title: "Panduan Transfer ke Bank Lain (Transfer Antarbank)",
    category: "Transfers",
    content: "Untuk mengirim uang ke bank lain: Pilih menu 'Kirim & Bayar' di Beranda, ketuk 'Kontak Baru', ketik nama bank & nomor rekening tujuan. Tentukan nominal transfer, lantas pilih opsi transfer: BI-FAST (Rp2.500) atau Online Real-Time (Rp6.500). Konfirmasi data penerima dan masukkan PIN Jago Anda."
  },
  {
    title: "Solusi Gagal Transfer / Kendala Kirim Uang",
    category: "Transfers",
    content: "Jika transfer Anda gagal atau bermasalah, cek: 1) Registrasi Akun: Pastikan KYC via video call telah sukses. 2) Saldo Kantong Jago: Pastikan sisa saldo Anda mencukupi nominal transfer dan biaya transaksi. 3) Limit Harian Keamanan: Pastikan transaksi Anda dalam limit harian yang ditentukan. 4) Sistem Bank Penerima Maintenance / Down."
  },
  {
    title: "BI-FAST Transfer Limits & Fees",
    category: "Transfers",
    content: "Layanan BI-FAST di Bank Jago memungkinkan transfer antarbank real-time dengan biaya Rp2.500 per transaksi. Batas nominal transaksi BI-FAST adalah Rp250.000.000 per transaksi dan maksimal Rp250.000.000 total akumulatif per hari."
  },
  {
    title: "Kantong Terkunci (Locked Pocket) FAQ",
    category: "Savings",
    content: "Kantong Terkunci adalah simpanan berjangka dengan bunga hingga 5.0% per tahun. Nasabah dapat mengunci dana dari minimal 14 hari hingga 6 bulan. Melakukan penarikan sebelum jatuh tempo (early withdrawal) diperbolehkan, namun bunga berjalan akan hangus dan tidak dibayarkan."
  },
  {
    title: "Cara Menautkan Rekening Jago ke Gopay",
    category: "Partner Integrations",
    content: "Untuk menghubungkan Jago ke GoTo (Gojek/Gopay): Buka aplikasi Gojek, ketuk metode pembayaran, pilih 'Hubungkan Bank Jago'. Masukkan kredensial dan lakukan verifikasi OTP. Setelah terhubung, nasabah dapat bertransaksi langsung menggunakan saldo Kantong Jago di Gojek tanpa biaya top-up."
  },
  {
    title: "Pemesanan Kartu Debit Fisik Jago",
    category: "Debits Card",
    content: "Nasabah dapat meminta penerbitan Kartu Debit Fisik Visa Jago langsung dari aplikasi Jago. Pilih menu 'Kartu', ketuk 'Buat Kartu', pilih 'Kartu Fisik'. Kartu akan dicetak dengan nama kustom Anda dan dikirim ke alamat rumah dalam waktu 3-5 hari kerja (Jawa/Bali) atau 5-10 hari kerja (luar Jawa)."
  },
  {
    title: "Biaya Administrasi Bulanan Bank Jago",
    category: "General Account",
    content: "Kabar gembira! Bank Jago berkomitmen penuh untuk membebaskan biaya administrasi bulanan (Rp0) untuk seluruh nasabah setianya. Tidak ada ketentuan saldo minimum mengendap untuk menghindarkan biaya admin."
  }
];
