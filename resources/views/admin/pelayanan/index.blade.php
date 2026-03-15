@extends('layouts.admin')

@section('content')

    <h2>Data Pelayanan</h2>

    <a href="/admin/pelayanan/create">Tambah Pelayanan</a>

    <table border="1">

        <tr>
            <th>No</th>
            <th>Nama</th>
            <th>Aksi</th>
        </tr>

        @foreach($pelayanan as $p)

            <tr>
                <td>{{ $loop->iteration }}</td>
                <td>{{ $p->nama_pelayanan }}</td>

                <td>

                    <a href="/admin/pelayanan/{{ $p->id }}/edit">Edit</a>

                    <form action="/admin/pelayanan/{{ $p->id }}" method="POST">

                        @csrf
                        @method('DELETE')

                        <button type="submit">Hapus</button>

                    </form>

                </td>

            </tr>

        @endforeach

    </table>

@endsection