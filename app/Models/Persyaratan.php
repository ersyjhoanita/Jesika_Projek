<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Persyaratan extends Model
{
    protected $fillable = [
        'pelayanan_id',
        'nama_file',
        'file_pdf'
    ];

    public function pelayanan()
    {
        return $this->belongsTo(Pelayanan::class);
    }
}