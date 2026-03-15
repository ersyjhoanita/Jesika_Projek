<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Pelayanan;
use App\Models\Pengajuan;
use App\Models\BerkasPengajuan;

class PublicController extends Controller
{

    public function home()
    {
        return view('public.home');
    }

    public function pelayanan()
    {
        $pelayanan = Pelayanan::all();
        return view('public.pelayanan', compact('pelayanan'));
    }

    public function form()
    {
        $pelayanan = Pelayanan::all();
        return view('public.pengajuan', compact('pelayanan'));
    }

    public function simpan(Request $request)
    {

        $request->validate([
            'nama' => 'required',
            'nik' => 'required',
            'alamat' => 'required',
            'no_hp' => 'required',
            'pelayanan_id' => 'required'
        ]);

        $pengajuan = Pengajuan::create([
            'nama' => $request->nama,
            'nik' => $request->nik,
            'alamat' => $request->alamat,
            'no_hp' => $request->no_hp,
            'pelayanan_id' => $request->pelayanan_id,
            'tanggal_pengajuan' => date('Y-m-d'),
            'status' => 'diproses'
        ]);

        // Upload KTP
        $ktp = $request->file('ktp');
        $namaKtp = time() . '_' . $ktp->getClientOriginalName();
        $ktp->move(public_path('uploads/ktp'), $namaKtp);

        // Upload KK
        $kk = $request->file('kk');
        $namaKk = time() . '_' . $kk->getClientOriginalName();
        $kk->move(public_path('uploads/kk'), $namaKk);

        // Upload berkas tambahan
        $namaBerkas = null;

        if ($request->file('berkas_lain')) {

            $file = $request->file('berkas_lain');
            $namaBerkas = time() . '_' . $file->getClientOriginalName();
            $file->move(public_path('uploads/berkas_lain'), $namaBerkas);

        }

        BerkasPengajuan::create([
            'pengajuan_id' => $pengajuan->id,
            'ktp' => $namaKtp,
            'kk' => $namaKk,
            'berkas_lain' => $namaBerkas
        ]);

        return redirect('/pengajuan')->with('success', 'Pengajuan berhasil dikirim');

    }

    public function status(Request $request)
    {
        $pengajuan = Pengajuan::where('nik', $request->nik)->get();
        return view('public.status', compact('pengajuan'));
    }

}