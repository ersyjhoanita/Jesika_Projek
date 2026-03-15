@extends('layouts.admin')

@section('content')

    <div class="container">

        <h3 class="mb-4">Daftar Persyaratan</h3>

        <a href="{{ route('persyaratan.create') }}" class="btn btn-primary mb-3">
            Tambah Persyaratan
        </a>

        <table class="table table-bordered">

            <thead>

                <tr>
                    <th>No</th>
                    <th>Pelayanan</th>
                    <th>Nama File</th>
                    <th>Aksi</th>
                </tr>

            </thead>

            <tbody>

                @foreach($persyaratan as $p)

                    <tr>

                        <td>{{ $loop->iteration }}</td>

                        <td>{{ $p->pelayanan->nama_pelayanan }}</td>

                        <td>{{ $p->nama_file }}</td>

                        <td>

                            <a href="{{ route('persyaratan.edit', $p->id) }}" class="btn btn-warning btn-sm">
                                Edit
                            </a>

                            <form action="{{ route('persyaratan.destroy', $p->id) }}" method="POST" style="display:inline;">

                                @csrf
                                @method('DELETE')

                                <button class="btn btn-danger btn-sm">
                                    Hapus
                                </button>

                            </form>

                        </td>

                    </tr>

                @endforeach

            </tbody>

        </table>

    </div>

@endsection