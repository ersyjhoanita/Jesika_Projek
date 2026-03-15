@extends('layouts.admin')

@section('content')

    <h2>Data Pengajuan</h2>

    <table class="table table-bordered">

        <tr>
            <th>Nama</th>
            <th>Pelayanan</th>
            <th>KTP</th>
            <th>KK</th>
            <th>Status</th>
            <th>Aksi</th>
        </tr>

        @foreach($pengajuan as $p)

            <tr>

                <td>{{ $p->nama }}</td>

                <td>{{ $p->pelayanan->nama_pelayanan }}</td>

                <td>
                    <a href="/uploads/ktp/{{ $p->berkas->ktp }}" target="_blank">
                        Lihat KTP
                    </a>
                </td>

                <td>
                    <a href="/uploads/kk/{{ $p->berkas->kk }}" target="_blank">
                        Lihat KK
                    </a>
                </td>

                <td>{{ $p->status }}</td>

                <td>

                    <a href="/admin/pengajuan/{{ $p->id }}">
                        Detail
                    </a>

                </td>

            </tr>

        @endforeach

    </table>

@endsection