@extends('layouts.admin')

@section('content')

    <div class="container">

        <h3 class="mb-4">Edit Persyaratan</h3>

        <form method="POST" action="{{ route('persyaratan.update', $persyaratan->id) }}">

            @csrf
            @method('PUT')

            <div class="mb-3">

                <label>Nama File</label>

                <input type="text" name="nama_file" value="{{ $persyaratan->nama_file }}" class="form-control">

            </div>

            <button class="btn btn-primary">
                Update
            </button>

        </form>

    </div>

@endsection