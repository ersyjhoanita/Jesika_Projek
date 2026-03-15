@extends('layouts.public')

@section('content')

    <h3 class="mb-4">Form Pengajuan Pelayanan</h3>

    <div class="card shadow p-4">

        <form method="POST" action="/pengajuan" enctype="multipart/form-data">

            @csrf

            <div class="mb-3">
                <label class="form-label">Nama</label>
                <input type="text" name="nama" class="form-control">
            </div>

            <div class="mb-3">
                <label class="form-label">NIK</label>
                <input type="text" name="nik" class="form-control">
            </div>

            <div class="mb-3">
                <label class="form-label">Alamat</label>
                <textarea name="alamat" class="form-control"></textarea>
            </div>

            <div class="mb-3">
                <label class="form-label">No HP</label>
                <input type="text" name="no_hp" class="form-control">
            </div>

            <div class="mb-3">

                <label class="form-label">Jenis Pelayanan</label>

                <select name="pelayanan_id" class="form-select">

                    <option>Pilih Pelayanan</option>

                    @foreach($pelayanan as $p)

                        <option value="{{ $p->id }}">
                            {{ $p->nama_pelayanan }}
                        </option>

                    @endforeach

                </select>

            </div>

            <div class="mb-3">
                <label class="form-label">Upload KTP</label>
                <input type="file" name="ktp" class="form-control">
            </div>

            <div class="mb-3">
                <label class="form-label">Upload KK</label>
                <input type="file" name="kk" class="form-control">
            </div>

            <div class="mb-3">
                <label class="form-label">Berkas Tambahan</label>
                <input type="file" name="berkas" class="form-control">
            </div>

            <button class="btn btn-primary">
                Ajukan Pelayanan
            </button>

        </form>

    </div>

@endsection