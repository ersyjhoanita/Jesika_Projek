@extends('layouts.admin')

@section('content')

    <div class="container">

        <h3 class="mb-4">Edit Pelayanan</h3>

        <form method="POST" action="{{ route('pelayanan.update', $pelayanan->id) }}">

            @csrf
            @method('PUT')

            <div class="mb-3">

                <label>Nama Pelayanan</label>

                <input type="text" name="nama_pelayanan" value="{{ $pelayanan->nama_pelayanan }}" class="form-control">

            </div>

            <div class="mb-3">

                <label>Deskripsi</label>

                <textarea name="deskripsi" class="form-control">

    {{ $pelayanan->deskripsi }}

    </textarea>

            </div>

            <button class="btn btn-primary">
                Update
            </button>

        </form>

    </div>

@endsection