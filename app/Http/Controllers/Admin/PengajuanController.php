<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Pengajuan;
use Illuminate\Http\Request; // ini yang ditambahkan

class PengajuanController extends Controller
{

    public function index()
    {

        $pengajuan = Pengajuan::with('pelayanan', 'berkas')->get();

        return view('admin.pengajuan.index', compact('pengajuan'));

    }

    public function show($id)
    {

        $pengajuan = Pengajuan::with('berkas', 'pelayanan')->find($id);

        return view('admin.pengajuan.detail', compact('pengajuan'));

    }

    public function updateStatus(Request $request, $id)
    {

        Pengajuan::where('id', $id)->update([
            'status' => $request->status
        ]);

        return redirect('/admin/pengajuan');

    }

}