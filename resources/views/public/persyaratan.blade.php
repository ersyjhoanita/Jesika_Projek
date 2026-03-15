@extends('layouts.public')

@section('content')

    <style>
        body {
            background: #f5f6fa;
        }

        .upload-box {
            border: 2px dashed #d1d5db;
            border-radius: 10px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: 0.3s;
        }

        .upload-box:hover {
            background: #f8f9fa;
        }

        .upload-icon {
            font-size: 40px;
            color: #6c757d;
        }

        .file-info {
            margin-top: 10px;
            color: #555;
        }
    </style>

    <div class="container mt-5">

        <h3 class="fw-bold">
            ⬆️ Upload Persyaratan PDF
        </h3>

        <p class="text-muted">
            Upload dokumen persyaratan dalam format PDF
        </p>

        <form>

            <div class="mb-3">
                <label class="form-label fw-semibold">
                    Pilih Pelayanan *
                </label>

                <select class="form-select">
                    <option>-- Pilih Pelayanan --</option>
                    <option>Surat Keterangan Domisili</option>
                    <option>Surat Pengantar SKCK</option>
                    <option>Surat Keterangan Usaha</option>
                </select>
            </div>


            <div class="mb-3">
                <label class="form-label fw-semibold">
                    Nama File/Dokumen *
                </label>

                <input type="text" class="form-control" placeholder="Masukkan nama file">
            </div>


            <div class="mb-3">

                <label class="form-label fw-semibold">
                    File PDF *
                </label>

                <div class="upload-box" onclick="document.getElementById('fileInput').click()">

                    <div class="upload-icon">☁️</div>

                    <p class="mt-2 fw-semibold">
                        Klik untuk upload atau drag & drop
                    </p>

                    <p class="text-muted">
                        Format PDF • Maksimal 5 MB
                    </p>

                    <input type="file" id="fileInput" accept="application/pdf" hidden onchange="showFileName(this)">
                </div>

                <div class="file-info" id="fileName"></div>

            </div>

            <button class="btn btn-primary">
                Upload File
            </button>

        </form>

    </div>

    <script>
        function showFileName(input) {
            if (input.files.length > 0) {
                document.getElementById("fileName").innerHTML =
                    "📄 File yang dipilih: " + input.files[0].name;
            }
        }
    </script>

@endsection