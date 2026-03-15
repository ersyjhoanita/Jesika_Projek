<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Persyaratan;
use App\Models\Pelayanan;

class PersyaratanController extends Controller
{

    public function index()
    {

        $persyaratan = Persyaratan::with('pelayanan')->get();

        return view('admin.persyaratan.index', compact('persyaratan'));

    }

    public function create()
    {

        $pelayanan = Pelayanan::all();

        return view('admin.persyaratan.create', compact('pelayanan'));

    }

    public function store(Request $request)
    {

        $file = $request->file('file_pdf');

        $namaFile = time() . '_' . $file->getClientOriginalName();

        $file->move(public_path('pdf/persyaratan'), $namaFile);

        Persyaratan::create([

            'pelayanan_id' => $request->pelayanan_id,
            'nama_file' => $request->nama_file,
            'file_pdf' => $namaFile

        ]);

        return redirect('/admin/persyaratan');

    }

}