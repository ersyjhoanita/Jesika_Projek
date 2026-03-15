@extends('layouts.public')

@section('content')

    <h3 class="mb-4">Cek Status Pengajuan</h3>

    <div class="card shadow p-4">

        <form method="GET" action="/status">

            <div class="mb-3">

                <label class="form-label">
                    Masukkan NIK
                </label>

                <input type="text" name="nik" class="form-control">

            </div>

            <button class="btn btn-primary">
                Cek Status
            </button>

        </form>

    </div>

@endsection