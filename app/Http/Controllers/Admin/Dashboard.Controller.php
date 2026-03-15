<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Pelayanan;
use App\Models\Pengajuan;

class DashboardController extends Controller
{

    public function index()
    {

        $jumlahPelayanan = Pelayanan::count();

        $jumlahPengajuan = Pengajuan::count();

        $diproses = Pengajuan::where('status', 'diproses')->count();


        $selesai = Pengajuan::where('status', 'selesai')->count();

        return view('admin.dashboard', compact(
            'jumlahPelayanan',
            'jumlahPengajuan',
            'diproses',
            'selesai'
        ));

    }

}
