@extends('layouts.admin')

@section('content')

    <h2>Detail Pengajuan</h2>

    <p>Nama : {{ $pengajuan->nama }}</p>

    <p>Pelayanan : {{ $pengajuan->pelayanan->nama_pelayanan }}</p>

    <p>
        <a href="/uploads/ktp/{{ $pengajuan->berkas->ktp }}">
            Download KTP
        </a>
    </p>

    <p>
        <a href="/uploads/kk/{{ $pengajuan->berkas->kk }}">
            Download KK
        </a>
    </p>

    <form method="POST" action="/admin/pengajuan/update-status/{{ $pengajuan->id }}">

        @csrf

        <select name="status">

            <option value="diproses">Diproses</option>
            <option value="selesai">Selesai</option>
            <option value="ditolak">Ditolak</option>

        </select>

        <br><br>

        <button class="btn btn-success">
            Update Status
        </button>

    </form>

@endsection