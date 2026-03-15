<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Pelayanan;

class PelayananController extends Controller
{

    public function index()
    {
        $pelayanan = Pelayanan::all();
        return view('admin.pelayanan.index', compact('pelayanan'));
    }

    public function create()
    {
        return view('admin.pelayanan.create');
    }

    public function store(Request $request)
    {

        $request->validate([
            'nama_pelayanan' => 'required'
        ]);

        Pelayanan::create([
            'nama_pelayanan' => $request->nama_pelayanan,
            'deskripsi' => $request->deskripsi
        ]);

        return redirect('/admin/pelayanan');

    }

    public function edit($id)
    {

        $pelayanan = Pelayanan::find($id);

        return view('admin.pelayanan.edit', compact('pelayanan'));

    }

    public function update(Request $request, $id)
    {

        Pelayanan::where('id', $id)->update([
            'nama_pelayanan' => $request->nama_pelayanan,
            'deskripsi' => $request->deskripsi
        ]);

        return redirect('/admin/pelayanan');

    }

    public function destroy($id)
    {

        Pelayanan::destroy($id);

        return redirect('/admin/pelayanan');

    }

}