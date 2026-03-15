@extends('layouts.public')

@section('content')

    <h3 class="mb-4">Daftar Pelayanan</h3>

    <div class="card shadow p-4">

        <table class="table table-bordered table-striped">

            <thead class="table-primary">

                <tr>
                    <th>No</th>
                    <th>Nama Pelayanan</th>
                    <th>Deskripsi</th>
                    <th>Persyaratan</th>
                </tr>

            </thead>

            <tbody>

                @foreach($pelayanan as $p)

                    <tr>

                        <td>{{ $loop->iteration }}</td>

                        <td>{{ $p->nama_pelayanan }}</td>

                        <td>{{ $p->deskripsi }}</td>

                        <td>

                            <a href="/persyaratan/{{ $p->id }}" class="btn btn-sm btn-primary">
                                Lihat
                            </a>

                        </td>

                    </tr>

                @endforeach

            </tbody>

        </table>

    </div>

@endsection