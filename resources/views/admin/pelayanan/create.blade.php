@extends('layouts.admin')

@section('content')

    <h2>Tambah Pelayanan</h2>

    <form action="/admin/pelayanan" method="POST">

        @csrf

        <label>Nama Pelayanan</label>

        <input type="text" name="nama_pelayanan">

        <br><br>

        <label>Deskripsi</label>

        <textarea name="deskripsi"></textarea>

        <br><br>

        <button type="submit">Simpan</button>

    </form>

@endsection