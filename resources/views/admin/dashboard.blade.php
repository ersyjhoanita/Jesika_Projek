@extends('layouts.admin')

@section('content')

    <h2>Dashboard Admin</h2>

    <div>

        <p>Total Pelayanan : {{ $jumlahPelayanan }}</p>

        <p>Total Pengajuan : {{ $jumlahPengajuan }}</p>

        <p>Pengajuan Diproses : {{ $diproses }}</p>

        <p>Pengajuan Selesai : {{ $selesai }}</p>

    </div>

@endsection