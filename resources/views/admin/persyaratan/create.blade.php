@extends('layouts.admin')

@section('content')

    <h2>Upload Persyaratan</h2>

    <form action="/admin/persyaratan" method="POST" enctype="multipart/form-data">

        @csrf

        <label>Pelayanan</label>

        <select name="pelayanan_id">

            @foreach($pelayanan as $p)

                <option value="{{ $p->id }}">
                    {{ $p->nama_pelayanan }}
                </option>

            @endforeach

        </select>

        <br><br>

        <label>Nama File</label>

        <input type="text" name="nama_file">

        <br><br>

        <label>Upload PDF</label>

        <input type="file" name="file_pdf">

        <br><br>

        <button type="submit">Upload</button>

    </form>

@endsection